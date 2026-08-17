from datetime import datetime, date

from sqlalchemy.exc import IntegrityError

from app.auth.authorization import AuthorizationDenied, AuthorizationService
from app.constants.roles import PRE_SALES_MANAGER, SOLUTION_ENGINEER, DELIVERY
from app.constants.activity_types import (
    POC_REQUESTED, POC_APPROVED, POC_REJECTED,
    POC_EXECUTION_STARTED, POC_RESULT_SUBMITTED, POC_COMPLETED,
    POC_DESIGN_CREATED, POC_DESIGN_UPDATED,
)
from app.database import db
from app.models.auth.user import User
from app.models.opportunity.poc_tracker import POCTracker
from app.repositories.poc_repository import PocRepository
from app.services.activity_service import ActivityService
from app.services.notification_service import NotificationService
from app.utils.concurrency import ConcurrencyManager
from app.constants.poc_outcome import (POC_STATUS_DRAFT, POC_STATUS_PENDING_APPROVAL, POC_STATUS_APPROVED, POC_STATUS_IN_PROGRESS, POC_STATUS_SUBMITTED, POC_STATUS_COMPLETED, POC_STATUS_REJECTED)
from app.constants.auth_constants import STATUS_APPROVED


class PocService:
    @staticmethod
    def get_by_id(poc_id, user, active_role):
        poc = PocRepository.get_by_id(poc_id)
        if not AuthorizationService.can_view_poc(user, active_role, poc):
            return None
        return poc

    @staticmethod
    def get_by_opportunity(opportunity_id, user, active_role):
        opportunity = PocRepository.get_opportunity(opportunity_id)
        if not AuthorizationService.can_view_opportunity(user, active_role, opportunity):
            return []
        return PocRepository.get_by_opportunity(opportunity_id)

    @staticmethod
    def request_poc(data, user, active_role):
        opportunity = PocRepository.get_opportunity(data["opportunity_id"])
        if not opportunity:
            return None
        if not AuthorizationService.can_request_poc(user, active_role, opportunity):
            raise AuthorizationDenied("Only an assigned Solution Engineer can request a POC.")
        required = ("objective", "success_metric", "exit_criteria", "target_date", "failure_condition")
        if any(not data.get(field) for field in required):
            raise ValueError("Objective, Success Criteria, Exit Criteria, Target Date and Failure Condition are required.")
        if data["target_date"] < date.today():
            raise ValueError("Target Date cannot be in the past.")

        payload = dict(data)
        payload["status"] = POC_STATUS_PENDING_APPROVAL
        payload["requested_by"] = user.user_id
        payload["stakeholder_signoff"] = False
        poc = PocRepository.create(payload)
        ActivityService.log(
            "POC", poc.poc_id, POC_REQUESTED,
            f"POC '{poc.poc_name}' requested by {user.full_name}.",
            user.user_id, commit=False,
        )
        ActivityService.log(
            "POC", poc.poc_id, POC_DESIGN_CREATED,
            f"POC design '{poc.poc_name}' created with the request.",
            user.user_id, commit=False,
        )
        managers = User.query.filter(
            User.active.is_(True),
            User.status == STATUS_APPROVED,
            User.roles.any(role=PRE_SALES_MANAGER),
        ).all()
        for manager in managers:
            NotificationService.queue(
                manager.user_id, POC_REQUESTED, "POC", poc.poc_id,
                f"POC '{poc.poc_name}' for Opportunity '{opportunity.opportunity_name}' requires approval.",
            )
        db.session.commit()
        return poc

    @staticmethod
    def get_pending_approval(user, active_role):
        if active_role != PRE_SALES_MANAGER:
            raise AuthorizationDenied("Only a Pre-Sales Manager can view pending POC approvals.")
        # Scope is filtered again below so a manager only sees opportunities in their authorized scope.
        return [
            poc for poc in PocRepository.get_pending_approval()
            if AuthorizationService.can_view_opportunity(user, active_role, poc.opportunity)
        ]

    @staticmethod
    def approve_poc(poc_id, updated_at, user, active_role):
        poc = PocRepository.get_by_id(poc_id)
        if not poc:
            return None
        if not AuthorizationService.can_approve_poc(user, active_role, poc):
            raise AuthorizationDenied("Only a Pre-Sales Manager can approve a pending POC.")
        if ConcurrencyManager.has_conflict(updated_at, poc.updated_at):
            raise RuntimeError("This POC changed since you opened it. Refresh before approving.")
        if not all([poc.objective, poc.success_metric, poc.exit_criteria, poc.target_date, poc.failure_condition]):
            raise ValueError("POC design is incomplete and cannot be approved.")

        poc.status = POC_STATUS_APPROVED
        poc.approved_by = user.user_id
        poc.approved_at = datetime.utcnow()
        ActivityService.log(
            "POC", poc.poc_id, POC_APPROVED,
            f"POC '{poc.poc_name}' approved by {user.full_name}.",
            user.user_id, commit=False,
        )
        delivery_ids = {
            member.user_id for member in poc.opportunity.team_members
            if member.role == DELIVERY
        }
        for uid in delivery_ids:
            NotificationService.queue(
                uid, POC_APPROVED, "POC", poc.poc_id,
                f"POC '{poc.poc_name}' is approved and ready for execution.",
            )
        db.session.commit()
        return poc

    @staticmethod
    def reject_poc(poc_id, reason, updated_at, user, active_role):
        poc = PocRepository.get_by_id(poc_id)
        if not poc:
            return None
        if not AuthorizationService.can_approve_poc(user, active_role, poc):
            raise AuthorizationDenied("Only a Pre-Sales Manager can reject a pending POC.")
        if ConcurrencyManager.has_conflict(updated_at, poc.updated_at):
            raise RuntimeError("This POC changed since you opened it. Refresh before rejecting.")
        if not reason or not reason.strip():
            raise ValueError("A rejection reason is required.")

        poc.status = POC_STATUS_REJECTED
        poc.rejection_reason = reason.strip()
        ActivityService.log(
            "POC", poc.poc_id, POC_REJECTED,
            f"POC '{poc.poc_name}' rejected. Reason: {reason.strip()}",
            user.user_id, commit=False,
        )
        if poc.requested_by:
            NotificationService.queue(
                poc.requested_by, POC_REJECTED, "POC", poc.poc_id,
                f"POC '{poc.poc_name}' was rejected: {reason.strip()}",
            )
        db.session.commit()
        return poc

    @staticmethod
    def update_design(poc_id, data, user, active_role):
        poc = PocRepository.get_by_id(poc_id)
        if not poc:
            return None
        if not AuthorizationService.can_edit_poc_design(user, active_role, poc):
            raise AuthorizationDenied("Only an assigned Solution Engineer can edit an unapproved POC design.")
        if ConcurrencyManager.has_conflict(data.get("updated_at"), poc.updated_at):
            raise RuntimeError("This POC changed since you opened it. Refresh before editing.")
        data = dict(data)
        data.pop("updated_at", None)
        if poc.status not in {POC_STATUS_DRAFT, POC_STATUS_PENDING_APPROVAL}:
            raise RuntimeError("Approved or decided POC design is locked.")
        for key, value in data.items():
            if key in {"poc_name", "objective", "success_metric", "exit_criteria", "target_date", "failure_condition", "remarks"}:
                setattr(poc, key, value)
        ActivityService.log(
            "POC", poc.poc_id, POC_DESIGN_UPDATED,
            f"POC design '{poc.poc_name}' updated.",
            user.user_id, commit=False,
        )
        db.session.commit()
        return poc

    @staticmethod
    def start_execution(poc_id, updated_at, user, active_role):
        poc = PocRepository.get_by_id(poc_id)
        if not poc:
            return None
        if not AuthorizationService.can_execute_poc(user, active_role, poc):
            raise AuthorizationDenied("Only assigned Delivery can execute an approved POC.")
        if poc.status != POC_STATUS_APPROVED:
            raise RuntimeError("Only an approved POC can start execution.")
        if ConcurrencyManager.has_conflict(updated_at, poc.updated_at):
            raise RuntimeError("This POC changed since you opened it. Refresh before starting execution.")
        poc.status = POC_STATUS_IN_PROGRESS
        poc.start_date = poc.start_date or date.today()
        ActivityService.log(
            "POC", poc.poc_id, POC_EXECUTION_STARTED,
            f"POC '{poc.poc_name}' execution started by {user.full_name}.",
            user.user_id, commit=False,
        )
        db.session.commit()
        return poc

    @staticmethod
    def submit_result(poc_id, data, user, active_role):
        poc = PocRepository.get_by_id(poc_id)
        if not poc:
            return None
        if not AuthorizationService.can_execute_poc(user, active_role, poc):
            raise AuthorizationDenied("Only assigned Delivery can submit the POC result.")
        if poc.status != POC_STATUS_IN_PROGRESS:
            raise RuntimeError("POC must be In Progress before a result can be submitted.")
        if data.get("execution_status") != POC_STATUS_SUBMITTED:
            raise ValueError("Execution status must be Submitted when submitting a POC result.")
        if ConcurrencyManager.has_conflict(data.get("updated_at"), poc.updated_at):
            raise RuntimeError("This POC changed since you opened it. Refresh before submitting.")
        poc.status = POC_STATUS_SUBMITTED
        poc.poc_access_link = data["poc_access_link"]
        poc.outcome = data["outcome"]
        poc.outcome_notes = data["outcome_notes"]
        poc.remarks = data.get("remarks")
        poc.submitted_by = user.user_id
        poc.submitted_at = datetime.utcnow()
        poc.end_date = date.today()
        ActivityService.log(
            "POC", poc.poc_id, POC_RESULT_SUBMITTED,
            f"POC '{poc.poc_name}' result submitted by {user.full_name}.",
            user.user_id, commit=False,
        )
        for member in poc.opportunity.team_members:
            if member.role == SOLUTION_ENGINEER:
                NotificationService.queue(
                    member.user_id, POC_RESULT_SUBMITTED, "POC", poc.poc_id,
                    f"POC '{poc.poc_name}' result is ready for your technical review.",
                )
        db.session.commit()
        return poc

    @staticmethod
    def complete_poc(poc_id, updated_at, user, active_role):
        poc = PocRepository.get_by_id(poc_id)
        if not poc:
            return None
        if not AuthorizationService.can_complete_poc(user, active_role, poc):
            raise AuthorizationDenied("Only an assigned Solution Engineer can complete a submitted POC.")
        if ConcurrencyManager.has_conflict(updated_at, poc.updated_at):
            raise RuntimeError("This POC changed since you opened it. Refresh before completing.")
        poc.status = POC_STATUS_COMPLETED
        ActivityService.log(
            "POC", poc.poc_id, POC_COMPLETED,
            f"POC '{poc.poc_name}' marked Completed after Solution Engineer review.",
            user.user_id, commit=False,
        )
        db.session.commit()
        return poc

    @staticmethod
    def delete_poc(poc_id, user, active_role):
        poc = PocRepository.get_by_id(poc_id)
        if not poc:
            return False
        raise AuthorizationDenied("POCs are immutable business records and cannot be deleted.")
