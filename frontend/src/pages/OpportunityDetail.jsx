import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import StakeholderForm from "../components/StakeholderForm";
import {
    getPocsByOpportunity, requestPoc, startPocExecution, submitPocResult,
    completePoc
} from "../api/pocApi";
import { getStakeholdersByOpportunity } from "../api/stakeholderApi";
import {
    getOpportunity, getOpportunityStageHistory, updateOpportunity,
    qualifyOpportunity, submitOpportunityForReview, transitionTechnicalStage,
    closeWon, closeLost
} from "../api/opportunityApi";
import { getSolutionDesign, updateSolutionDesign } from "../api/solutionDesignApi";
import { ROLES } from "../auth/roles";
import { useAuth } from "../context/AuthContext";
import { getUser } from "../auth/authStorage";

const Box = ({ title, children }) => (
    <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20 }}>
        <h2>{title}</h2>{children}
    </section>
);

export default function OpportunityDetail() {
    const { id } = useParams();
    const opportunityId = Number(id);
    const { activeRole } = useAuth();
    const currentUserId = Number(getUser()?.user_id);

    const [opportunity, setOpportunity] = useState(null);
    const [history, setHistory] = useState([]);
    const [pocs, setPocs] = useState([]);
    const [design, setDesign] = useState(null);
    const [stakeholders, setStakeholders] = useState([]);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [edit, setEdit] = useState(null);
    const [designEdit, setDesignEdit] = useState(null);
    const [pocForm, setPocForm] = useState({
        poc_name: "", objective: "", success_metric: "", exit_criteria: "",
        target_date: "", failure_condition: "", remarks: ""
    });
    const [resultForms, setResultForms] = useState({});

    const load = async () => {
        try {
            setError("");
            const data = await getOpportunity(opportunityId);
            setOpportunity(data);
            setEdit({
                opportunity_name: data.opportunity_name || "",
                description: data.description || "",
                estimated_value: data.estimated_value ?? "",
                probability: data.probability ?? 0,
                expected_close_date: data.expected_close_date || "",
            });
            setHistory(await getOpportunityStageHistory(opportunityId));
            const [p, s, d] = await Promise.all([
                getPocsByOpportunity(opportunityId).catch(() => []),
                getStakeholdersByOpportunity(opportunityId).catch(() => []),
                getSolutionDesign(opportunityId).catch(() => null),
            ]);
            setPocs(p); setStakeholders(s); setDesign(d);
            setDesignEdit(d || {
                solution_summary: "", technical_approach: "", technical_requirements: "",
                architecture_notes: "", risks: "", assumptions: ""
            });
        } catch (err) {
            setError(err.response?.data?.message || "Unable to load opportunity.");
        }
    };

    useEffect(() => {
        if (!Number.isNaN(opportunityId)) load();
    }, [opportunityId]);

    const assignedSE = opportunity?.team_members?.some(
        m => m.role === ROLES.SOLUTION_ENGINEER && m.user_id === currentUserId
    );
    const assignedDelivery = opportunity?.team_members?.some(
        m => m.role === ROLES.DELIVERY && m.user_id === currentUserId
    );

    const canEditSales =
        activeRole === ROLES.SALES_EXECUTIVE &&
        opportunity?.created_by === currentUserId &&
        opportunity?.status === "Open" &&
        opportunity?.is_active &&
        ["Lead / Identified", "Qualification"].includes(opportunity?.current_stage?.stage_name);

    const designLockedByPoc = pocs.some(poc => ["Approved", "In Progress", "Submitted", "Completed"].includes(poc.status));
    const canEditDesign = activeRole === ROLES.SOLUTION_ENGINEER && assignedSE && opportunity?.is_active && !designLockedByPoc;
    const technicalStage = opportunity?.current_stage?.stage_name;

    const run = async (fn) => {
        try { setSaving(true); setError(""); await fn(); await load(); }
        catch (e) { setError(e.response?.data?.message || "Action failed."); }
        finally { setSaving(false); }
    };

    const saveSales = () => run(() => updateOpportunity(opportunityId, {
        ...edit,
        estimated_value: edit.estimated_value === "" ? null : edit.estimated_value,
        probability: Number(edit.probability || 0),
        expected_close_date: edit.expected_close_date || null,
        updated_at: opportunity.updated_at,
    }));

    const saveDesign = () => run(async () => {
        const payload = { ...designEdit, updated_at: opportunity.updated_at };
        await updateSolutionDesign(opportunityId, payload);
    });

    const submitPocRequest = () => run(async () => {
        await requestPoc({ opportunity_id: opportunityId, ...pocForm });
        setPocForm({ poc_name: "", objective: "", success_metric: "", exit_criteria: "", target_date: "", failure_condition: "", remarks: "" });
    });

    const stage = (target_stage) => run(() =>
        transitionTechnicalStage(opportunityId, {
            target_stage, updated_at: opportunity.updated_at
        })
    );

    const close = (won) => {
        const reason = window.prompt(won ? "Optional close remarks" : "Closed Lost reason");
        if (!won && !reason?.trim()) return;
        return run(() => (won ? closeWon : closeLost)(opportunityId, {
            reason: reason || "", updated_at: opportunity.updated_at
        }));
    };

    if (!opportunity) return <div style={{ padding: 24 }}>{error || "Loading opportunity..."}</div>;

    return (
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24, maxWidth: 1150, margin: "0 auto" }}>
            {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

            <Box title={opportunity.opportunity_name}>
                <p><b>Account:</b> {opportunity.account_name || opportunity.account_id}</p>
                <p><b>Created By:</b> {opportunity.created_by_user?.full_name || "Not recorded"}</p>
                <p><b>Sales Owner:</b> {opportunity.sales_owner?.full_name || "Pending assignment"}</p>
                <p><b>Stage:</b> {technicalStage}</p>
                <p><b>Status:</b> {opportunity.status}</p>
                <p><b>Lifecycle:</b> {opportunity.lifecycle_state}</p>
            </Box>

            {canEditSales && <Box title="Edit Opportunity">
                <div style={{ display: "grid", gap: 10 }}>
                    <input value={edit.opportunity_name} onChange={e => setEdit({...edit, opportunity_name: e.target.value})} />
                    <textarea value={edit.description} onChange={e => setEdit({...edit, description: e.target.value})} />
                    <input type="number" value={edit.estimated_value} onChange={e => setEdit({...edit, estimated_value: e.target.value})} />
                    <input type="number" min="0" max="100" value={edit.probability} onChange={e => setEdit({...edit, probability: e.target.value})} />
                    <input type="date" value={edit.expected_close_date} onChange={e => setEdit({...edit, expected_close_date: e.target.value})} />
                </div>
                <button disabled={saving} onClick={saveSales}>Save Changes</button>
            </Box>}

            {activeRole === ROLES.SALES_EXECUTIVE && opportunity.created_by === currentUserId &&
                opportunity.status === "Open" && technicalStage === "Lead / Identified" &&
                <button disabled={saving} onClick={() => run(() => qualifyOpportunity(opportunityId))}>Qualify Opportunity</button>}

            {activeRole === ROLES.SALES_EXECUTIVE && opportunity.created_by === currentUserId &&
                opportunity.status === "Open" && technicalStage === "Qualification" &&
                <button disabled={saving} onClick={() => run(() => submitOpportunityForReview(opportunityId))}>Submit for Sales Manager Review</button>}

            <Box title="Sales Ownership">
                <p><b>Created By:</b> {opportunity.created_by_user?.full_name || "Not recorded"}</p>
                <p><b>Sales Owner:</b> {opportunity.sales_owner?.full_name || "Pending assignment"}</p>
            </Box>

            <Box title="Technical Team">
                <p><b>Solution Engineers:</b></p>
                <ul>{opportunity.team_members?.filter(m => m.role === ROLES.SOLUTION_ENGINEER).map(m =>
                    <li key={m.team_id}>{m.user?.full_name || `User #${m.user_id}`}</li>
                )}</ul>
                <p><b>Delivery:</b></p>
                <ul>{opportunity.team_members?.filter(m => m.role === ROLES.DELIVERY).map(m =>
                    <li key={m.team_id}>{m.user?.full_name || `User #${m.user_id}`}</li>
                )}</ul>
            </Box>

            {canEditDesign && <Box title="Technical Solution">
                <div style={{ display: "grid", gap: 10 }}>
                    {[
                        ["solution_summary", "Solution Summary"],
                        ["technical_approach", "Technical Approach"],
                        ["technical_requirements", "Technical Requirements"],
                        ["architecture_notes", "Architecture / Notes"],
                        ["risks", "Risks"],
                        ["assumptions", "Assumptions"],
                    ].map(([key, label]) => (
                        <label key={key}>{label}
                            <textarea value={designEdit?.[key] || ""} onChange={e => setDesignEdit({...designEdit, [key]: e.target.value})} />
                        </label>
                    ))}
                </div>
                <button disabled={saving} onClick={saveDesign}>Save Technical Design</button>
            </Box>}

            {!canEditDesign && design && <Box title="Technical Solution">
                <p><b>Solution Summary:</b> {design.solution_summary || "—"}</p>
                <p><b>Technical Approach:</b> {design.technical_approach || "—"}</p>
                <p><b>Technical Requirements:</b> {design.technical_requirements || "—"}</p>
                <p><b>Architecture / Notes:</b> {design.architecture_notes || "—"}</p>
                <p><b>Risks:</b> {design.risks || "—"}</p>
                <p><b>Assumptions:</b> {design.assumptions || "—"}</p>
            </Box>}

            {activeRole === ROLES.SOLUTION_ENGINEER && assignedSE && opportunity.is_active && (
                <Box title="Technical Stage Actions">
                    {technicalStage === "Qualification" && <button disabled={saving} onClick={() => stage("Discovery")}>Start Discovery</button>}
                    {technicalStage === "Discovery" && <>
                        <button disabled={saving} onClick={() => stage("POC / Technical Evaluation")}>Move to POC / Technical Evaluation</button>
                        <button disabled={saving} onClick={() => stage("Proposal")} style={{ marginLeft: 8 }}>Continue to Proposal</button>
                    </>}
                    {technicalStage === "POC / Technical Evaluation" && <button disabled={saving} onClick={() => stage("Proposal")}>Move to Proposal</button>}
                    {technicalStage === "Proposal" && <button disabled={saving} onClick={() => stage("Negotiation")}>Move to Negotiation</button>}
                    {technicalStage === "Negotiation" && <>
                        <button disabled={saving} onClick={() => close(true)}>Close Won</button>
                        <button disabled={saving} onClick={() => close(false)} style={{ marginLeft: 8 }}>Close Lost</button>
                    </>}
                </Box>
            )}

            {activeRole === ROLES.SOLUTION_ENGINEER && assignedSE && opportunity.is_active && (
                <Box title="Request New POC">
                    <div style={{ display: "grid", gap: 8 }}>
                        {[
                            ["poc_name", "POC Name"], ["objective", "Objective"],
                            ["success_metric", "Success Criteria"], ["exit_criteria", "Exit Criteria"],
                            ["target_date", "Target Date"], ["failure_condition", "Failure Condition"],
                            ["remarks", "Technical Remarks"]
                        ].map(([key, label]) => (
                            <label key={key}>{label}
                                {key === "target_date" ? <input type="date" value={pocForm[key]} onChange={e => setPocForm({...pocForm, [key]: e.target.value})} /> :
                                    <textarea value={pocForm[key]} onChange={e => setPocForm({...pocForm, [key]: e.target.value})} />}
                            </label>
                        ))}
                    </div>
                    <button disabled={saving || !["Discovery", "POC / Technical Evaluation"].includes(technicalStage)} onClick={submitPocRequest}>Request POC</button>
                    <p>New POCs enter Pending Approval and require Pre-Sales Manager approval.</p>
                </Box>
            )}

            <Box title="POCs">
                {!pocs.length && <p>No POCs recorded.</p>}
                {pocs.map(poc => {
                    const form = resultForms[poc.poc_id] || { poc_access_link: "", outcome: "Success", outcome_notes: "", remarks: "" };
                    return <div key={poc.poc_id} style={{ borderTop: "1px solid #e2e8f0", paddingTop: 16, marginTop: 16 }}>
                        <h3>{poc.poc_name} — {poc.status}</h3>
                        <p><b>Objective:</b> {poc.objective}</p>
                        <p><b>Success Criteria:</b> {poc.success_metric}</p>
                        <p><b>Exit Criteria:</b> {poc.exit_criteria || "—"}</p>
                        <p><b>Target Date:</b> {poc.target_date}</p>
                        <p><b>Failure Condition:</b> {poc.failure_condition}</p>
                        {poc.rejection_reason && <p><b>Rejection:</b> {poc.rejection_reason}</p>}
                        {poc.poc_access_link && <p><b>POC Access:</b>{" "}
                            {/^(https?:\/\/)/i.test(poc.poc_access_link)
                                ? <a href={poc.poc_access_link} target="_blank" rel="noreferrer" style={{ overflowWrap: "anywhere" }}>{poc.poc_access_link}</a>
                                : <span style={{ overflowWrap: "anywhere" }}>{poc.poc_access_link}</span>}
                        </p>}
                        {poc.outcome && <p><b>Outcome:</b> {poc.outcome} — {poc.outcome_notes}</p>}

                        {activeRole === ROLES.DELIVERY && assignedDelivery && poc.status === "Approved" &&
                            <button disabled={saving} onClick={() => run(() => startPocExecution(poc.poc_id, { updated_at: poc.updated_at }))}>Start POC</button>}

                        {activeRole === ROLES.DELIVERY && assignedDelivery && poc.status === "In Progress" && (
                            <div style={{ display: "grid", gap: 8 }}>
                                <input placeholder="POC access link / text" value={form.poc_access_link} onChange={e => setResultForms({...resultForms, [poc.poc_id]: {...form, poc_access_link: e.target.value}})} />
                                <select value={form.outcome} onChange={e => setResultForms({...resultForms, [poc.poc_id]: {...form, outcome: e.target.value}})}>
                                    {["Success", "Failure", "Ongoing", "Abandoned"].map(x => <option key={x}>{x}</option>)}
                                </select>
                                <textarea placeholder="Outcome notes" value={form.outcome_notes} onChange={e => setResultForms({...resultForms, [poc.poc_id]: {...form, outcome_notes: e.target.value}})} />
                                <textarea placeholder="Execution remarks" value={form.remarks} onChange={e => setResultForms({...resultForms, [poc.poc_id]: {...form, remarks: e.target.value}})} />
                                <button disabled={saving} onClick={() => run(() => submitPocResult(poc.poc_id, {...form, execution_status: "Submitted", updated_at: poc.updated_at}))}>Submit POC Result</button>
                            </div>
                        )}

                        {activeRole === ROLES.SOLUTION_ENGINEER && assignedSE && poc.status === "Submitted" &&
                            <button disabled={saving} onClick={() => run(() => completePoc(poc.poc_id, { updated_at: poc.updated_at }))}>Complete After Review</button>}
                    </div>;
                })}
            </Box>

            {activeRole === ROLES.SOLUTION_ENGINEER && assignedSE && opportunity.is_active && (
                <Box title="Stakeholders">
                    <StakeholderForm opportunityId={opportunityId} />
                    <ul>{stakeholders.map(s => <li key={s.stakeholder_id}>{s.stakeholder_name} — {s.designation || "—"}</li>)}</ul>
                </Box>
            )}

            <Box title="Stage History">
                {history.length ? <ul>{history.map(entry => <li key={entry.history_id}>
                    {entry.stage?.stage_name || `Stage #${entry.stage_id}`} — {entry.user?.full_name || "System"}{entry.remarks ? ` — ${entry.remarks}` : ""}
                </li>)}</ul> : <p>No stage history recorded.</p>}
            </Box>
        </div>
    );
}
