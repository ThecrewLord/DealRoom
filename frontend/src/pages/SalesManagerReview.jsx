import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    getEligibleSalesOwners,
    getSalesManagerReviewQueue,
    reviewOpportunity,
} from "../api/opportunityApi";

export default function SalesManagerReview() {
    const navigate = useNavigate();
    const [queue, setQueue] = useState([]);
    const [owners, setOwners] = useState([]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(null);
    const [selection, setSelection] = useState({});

    const load = async () => {
        try {
            setError("");
            const [items, candidates] = await Promise.all([
                getSalesManagerReviewQueue(),
                getEligibleSalesOwners(),
            ]);
            setQueue(items);
            setOwners(candidates);
        } catch (err) {
            setError(err.response?.data?.message || "Unable to load review queue.");
        }
    };

    useEffect(() => { load(); }, []);

    const approve = async (opportunity) => {
        const ownerId = selection[opportunity.opportunity_id]?.ownerId;
        if (!ownerId) {
            setError("Select a Sales Executive as Sales Owner before approving.");
            return;
        }
        try {
            setBusy(opportunity.opportunity_id);
            await reviewOpportunity(opportunity.opportunity_id, {
                decision: "APPROVE",
                sales_owner_id: Number(ownerId),
                updated_at: opportunity.updated_at,
            });
            await load();
        } catch (err) {
            setError(err.response?.data?.message || "Approval failed.");
        } finally {
            setBusy(null);
        }
    };

    const reject = async (opportunity) => {
        const reason = selection[opportunity.opportunity_id]?.reason?.trim();
        if (!reason) {
            setError("A rejection reason is required.");
            return;
        }
        if (!window.confirm("Reject this opportunity? The decision is final.")) return;
        try {
            setBusy(opportunity.opportunity_id);
            await reviewOpportunity(opportunity.opportunity_id, {
                decision: "REJECT",
                reason,
                updated_at: opportunity.updated_at,
            });
            await load();
        } catch (err) {
            setError(err.response?.data?.message || "Rejection failed.");
        } finally {
            setBusy(null);
        }
    };

    const update = (id, patch) =>
        setSelection(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

    return (
        <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
            <h1>Sales Manager Review Queue</h1>
            <p>Only opportunities explicitly submitted for manager review appear here.</p>
            {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

            {queue.map(opportunity => {
                const state = selection[opportunity.opportunity_id] || {};
                return (
                    <section key={opportunity.opportunity_id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 }}>
                        <button onClick={() => navigate(`/opportunity/${opportunity.opportunity_id}`)}>
                            Open full opportunity
                        </button>
                        <h2>{opportunity.opportunity_name}</h2>
                        <p><b>Account:</b> {opportunity.account_id}</p>
                        <p><b>Created By:</b> {opportunity.created_by_user?.full_name || "-"}</p>
                        <p><b>Stage:</b> {opportunity.current_stage?.stage_name || "-"} · <b>Status:</b> {opportunity.status}</p>
                        <p><b>Estimated Value:</b> {opportunity.estimated_value ?? "-"} · <b>Probability:</b> {opportunity.probability ?? "-"}%</p>
                        <p><b>Expected Close:</b> {opportunity.expected_close_date || "-"}</p>
                        <p>{opportunity.description || "No description provided."}</p>

                        <label>
                            Sales Owner{" "}
                            <select value={state.ownerId || ""} onChange={e => update(opportunity.opportunity_id, { ownerId: e.target.value })}>
                                <option value="">Select Sales Executive</option>
                                {owners.map(owner => <option key={owner.user_id} value={owner.user_id}>{owner.full_name}</option>)}
                            </select>
                        </label>

                        <div style={{ marginTop: 12 }}>
                            <textarea
                                rows={3}
                                placeholder="Required only for rejection"
                                value={state.reason || ""}
                                onChange={e => update(opportunity.opportunity_id, { reason: e.target.value })}
                            />
                        </div>

                        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                            <button disabled={busy === opportunity.opportunity_id} onClick={() => approve(opportunity)}>
                                Approve & Assign Owner
                            </button>
                            <button disabled={busy === opportunity.opportunity_id} onClick={() => reject(opportunity)}>
                                Reject
                            </button>
                        </div>
                    </section>
                );
            })}
            {!queue.length && <p>No opportunities are currently awaiting review.</p>}
        </div>
    );
}
