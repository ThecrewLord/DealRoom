import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    finalizePreSalesAssignment,
    getEligibleDeliveryUsers,
    getEligibleSolutionEngineers,
    getPendingPreSalesAssignments,
} from "../api/preSalesAssignmentApi";
import { ROLES } from "../auth/roles";
import { useAuth } from "../context/AuthContext";

export default function PreSalesAssignment() {
    const { activeRole } = useAuth();
    const navigate = useNavigate();
    const [queue, setQueue] = useState([]);
    const [solutionEngineers, setSolutionEngineers] = useState([]);
    const [deliveryUsers, setDeliveryUsers] = useState([]);
    const [selection, setSelection] = useState({});
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState("");

    const load = async () => {
        try {
            setError("");
            const [pending, engineers, delivery] = await Promise.all([
                getPendingPreSalesAssignments(),
                getEligibleSolutionEngineers(),
                getEligibleDeliveryUsers(),
            ]);
            setQueue(pending);
            setSolutionEngineers(engineers);
            setDeliveryUsers(delivery);
        } catch (err) {
            setError(err?.response?.data?.message || "Unable to load technical assignments.");
        }
    };

    useEffect(() => {
        if (activeRole === ROLES.PRE_SALES_MANAGER) {
            load();
        }
    }, [activeRole]);

    const updateSelection = (opportunityId, field, values) => {
        setSelection((current) => ({
            ...current,
            [opportunityId]: {
                ...(current[opportunityId] || {}),
                [field]: values,
            },
        }));
    };

    const finalize = async (opportunity) => {
        const current = selection[opportunity.opportunity_id] || {};
        const solutionEngineerIds = (current.solution_engineer_ids || []).map(Number);
        const deliveryIds = (current.delivery_ids || []).map(Number);

        if (!solutionEngineerIds.length || !deliveryIds.length) {
            setError("Select at least one Solution Engineer and one Delivery user before finalizing.");
            return;
        }

        try {
            setBusy(opportunity.opportunity_id);
            setError("");
            await finalizePreSalesAssignment(opportunity.opportunity_id, {
                solution_engineer_ids: solutionEngineerIds,
                delivery_ids: deliveryIds,
                updated_at: opportunity.updated_at,
            });
            await load();
            setSelection((currentSelection) => {
                const next = { ...currentSelection };
                delete next[opportunity.opportunity_id];
                return next;
            });
        } catch (err) {
            setError(err?.response?.data?.message || "Unable to finalize technical assignment.");
        } finally {
            setBusy(null);
        }
    };

    if (activeRole !== ROLES.PRE_SALES_MANAGER) {
        return <div style={{ padding: 24 }}><h2>Unauthorized</h2></div>;
    }

    return (
        <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                <div>
                    <h1>Pending Technical Assignment</h1>
                    <p>Assign the complete technical team for approved opportunities.</p>
                </div>
                <button onClick={load}>Refresh</button>
            </div>

            {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

            <div style={{ display: "grid", gap: 18, marginTop: 20 }}>
                {queue.map((opportunity) => {
                    const current = selection[opportunity.opportunity_id] || {};
                    return (
                        <section
                            key={opportunity.opportunity_id}
                            style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 20, background: "white" }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                                <div>
                                    <button
                                        onClick={() => navigate(`/opportunity/${opportunity.opportunity_id}`)}
                                        style={{ border: 0, padding: 0, background: "none", fontSize: 20, fontWeight: 700, cursor: "pointer" }}
                                    >
                                        {opportunity.opportunity_name}
                                    </button>
                                    <p><b>Account:</b> {opportunity.account_name || `#${opportunity.account_id}`}</p>
                                    <p><b>Created By:</b> {opportunity.created_by_user?.full_name || "-"}</p>
                                    <p><b>Sales Owner:</b> {opportunity.sales_owner?.full_name || "-"}</p>
                                    <p><b>Stage:</b> {opportunity.current_stage?.stage_name || "-"}</p>
                                    <p><b>Status:</b> {opportunity.status}</p>
                                    <p><b>Estimated Value:</b> {opportunity.estimated_value ?? 0}</p>
                                    <p><b>Probability:</b> {opportunity.probability ?? 0}%</p>
                                    <p><b>Expected Close:</b> {opportunity.expected_close_date || "-"}</p>
                                    <p>{opportunity.description || "No description provided."}</p>
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
                                <label>
                                    <strong>Solution Engineer(s)</strong>
                                    <select
                                        multiple
                                        size={Math.min(Math.max(solutionEngineers.length, 3), 7)}
                                        value={current.solution_engineer_ids || []}
                                        onChange={(event) => updateSelection(
                                            opportunity.opportunity_id,
                                            "solution_engineer_ids",
                                            Array.from(event.target.selectedOptions, (option) => option.value)
                                        )}
                                        style={{ display: "block", width: "100%", minHeight: 120, marginTop: 8 }}
                                    >
                                        {solutionEngineers.map((candidate) => (
                                            <option key={candidate.user_id} value={candidate.user_id}>{candidate.full_name}</option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    <strong>Delivery</strong>
                                    <select
                                        multiple
                                        size={Math.min(Math.max(deliveryUsers.length, 3), 7)}
                                        value={current.delivery_ids || []}
                                        onChange={(event) => updateSelection(
                                            opportunity.opportunity_id,
                                            "delivery_ids",
                                            Array.from(event.target.selectedOptions, (option) => option.value)
                                        )}
                                        style={{ display: "block", width: "100%", minHeight: 120, marginTop: 8 }}
                                    >
                                        {deliveryUsers.map((candidate) => (
                                            <option key={candidate.user_id} value={candidate.user_id}>{candidate.full_name}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
                                <button
                                    disabled={busy === opportunity.opportunity_id}
                                    onClick={() => finalize(opportunity)}
                                >
                                    {busy === opportunity.opportunity_id ? "Finalizing..." : "Finalize Technical Assignment"}
                                </button>
                            </div>
                        </section>
                    );
                })}

                {!queue.length && <p>No opportunities are currently awaiting technical assignment.</p>}
            </div>
        </div>
    );
}
