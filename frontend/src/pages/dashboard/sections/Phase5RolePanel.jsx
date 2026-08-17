import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getOpportunities } from "../../../api/opportunityApi";
import { getPendingPreSalesAssignments } from "../../../api/preSalesAssignmentApi";
import { getPendingPocApprovals, getPocsByOpportunity } from "../../../api/pocApi";
import { ROLES } from "../../../auth/roles";
import { useAuth } from "../../../context/AuthContext";

export default function Phase5RolePanel() {
    const { activeRole } = useAuth();
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [pocItems, setPocItems] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                if (activeRole === ROLES.PRE_SALES_MANAGER) {
                    const [assignments, approvals] = await Promise.all([
                        getPendingPreSalesAssignments(),
                        getPendingPocApprovals(),
                    ]);
                    if (mounted) { setItems(assignments || []); setPocItems(approvals || []); }
                } else {
                    const opportunities = await getOpportunities();
                    const relevant = (opportunities || []).slice(0, 20);
                    const pairs = await Promise.all(relevant.map(async o => ({
                        opportunity: o,
                        pocs: await getPocsByOpportunity(o.opportunity_id).catch(() => [])
                    })));
                    const attention = pairs.flatMap(x => x.pocs
                        .filter(p => activeRole === ROLES.DELIVERY
                            ? ["Approved", "In Progress"].includes(p.status)
                            : p.status === "Submitted")
                        .map(p => ({ ...p, opportunity_name: x.opportunity.opportunity_name })));
                    if (mounted) { setItems(opportunities || []); setPocItems(attention); }
                }
                if (mounted) setError("");
            } catch (err) {
                if (mounted) setError(err?.response?.data?.message || "Unable to load technical workflow.");
            }
        };
        if ([ROLES.PRE_SALES_MANAGER, ROLES.SOLUTION_ENGINEER, ROLES.DELIVERY].includes(activeRole)) load();
        return () => { mounted = false; };
    }, [activeRole]);

    if (![ROLES.PRE_SALES_MANAGER, ROLES.SOLUTION_ENGINEER, ROLES.DELIVERY].includes(activeRole)) return null;

    const isManager = activeRole === ROLES.PRE_SALES_MANAGER;
    const pocTitle = isManager ? "Pending POC Approvals"
        : activeRole === ROLES.DELIVERY ? "POCs Requiring Execution" : "POCs Requiring Technical Review";

    return (
        <section className="figma-card dashboard-role-workflow-panel">
            <div className="figma-card-header">
                <div>
                    <h3>{isManager ? "Pending Technical Assignments" : "My Assigned Opportunities"}</h3>
                    <p>{isManager ? "Approved opportunities awaiting technical team allocation." : `Opportunities assigned to you as ${activeRole}.`}</p>
                </div>
                {isManager && <button onClick={() => navigate("/pre-sales/assignments")}>Open queue <ArrowRight size={12} /></button>}
            </div>
            {error ? <p>{error}</p> : items.length ? (
                <div className="dashboard-list">
                    {items.slice(0, 5).map(item => {
                        const id = item.opportunity_id;
                        return <button key={id} className="dashboard-workflow-item" onClick={() => navigate(`/opportunity/${id}`)}>
                            <strong>{item.opportunity_name || item.poc_name}</strong>
                            <span>{item.account_name || `Opportunity #${id}`} · {item.current_stage?.stage_name || item.status}</span>
                        </button>;
                    })}
                </div>
            ) : <div className="figma-dashboard-empty"><strong>No current technical items</strong></div>}

            <div className="dashboard-workflow-pocs">
                <h3>{pocTitle}</h3>
                {!pocItems.length ? <p>No POCs require attention.</p> : pocItems.slice(0, 5).map(p => (
                    <button key={p.poc_id} className="dashboard-workflow-item" onClick={() => navigate(`/opportunity/${p.opportunity_id}`)}>
                        <strong>{p.poc_name}</strong> — {p.opportunity_name || `Opportunity #${p.opportunity_id}`} · {p.status}
                    </button>
                ))}
            </div>
        </section>
    );
}
