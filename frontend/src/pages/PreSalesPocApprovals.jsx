import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPendingPocApprovals, approvePoc, rejectPoc } from "../api/pocApi";

export default function PreSalesPocApprovals() {
    const [items, setItems] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null);
    const [success, setSuccess] = useState("");
    const navigate = useNavigate();

    const load = async () => {
        try { setLoading(true); setItems(await getPendingPocApprovals()); setError(""); }
        catch (e) { setError(e.response?.data?.message || "Unable to load POC approvals."); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const decide = async (poc, approved) => {
        try {
            setBusy(poc.poc_id);
            setError("");
            setSuccess("");
            if (approved) {
                await approvePoc(poc.poc_id, { updated_at: poc.updated_at });
            } else {
                const reason = window.prompt("Rejection reason");
                if (!reason?.trim()) return;
                await rejectPoc(poc.poc_id, { reason: reason.trim(), updated_at: poc.updated_at });
            }
            setSuccess(`${poc.poc_name} ${approved ? "was approved" : "was rejected"}.`);
            await load();
        } catch (e) {
            setError(e.response?.data?.message || "Unable to decide on POC.");
        } finally {
            setBusy(null);
        }
    };

    return (
        <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
            <h1>Pending POC Approvals</h1>
            {loading && <p>Loading POC approvals…</p>}
            {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
            {success && <p>{success}</p>}
            {!loading && !items.length && <p>No POCs are waiting for approval.</p>}
            {items.map(poc => (
                <section key={poc.poc_id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 }}>
                    <h2>{poc.poc_name}</h2>
                    <p><b>Opportunity:</b> <button onClick={() => navigate(`/opportunity/${poc.opportunity_id}`)}>#{poc.opportunity_id}</button></p>
                    <p><b>Solution Engineer:</b> {poc.requester?.full_name || `User #${poc.requested_by}`}</p>
                    <p><b>Objective:</b> {poc.objective}</p>
                    <p><b>Success Criteria:</b> {poc.success_metric}</p>
                    <p><b>Exit Criteria:</b> {poc.exit_criteria}</p>
                    <p><b>Target Date:</b> {poc.target_date}</p>
                    <p><b>Failure Condition:</b> {poc.failure_condition}</p>
                    <p><b>Requested:</b> {poc.created_at ? new Date(poc.created_at).toLocaleString() : "—"}</p>
                    <button disabled={busy === poc.poc_id} onClick={() => decide(poc, true)}>{busy === poc.poc_id ? "Saving…" : "Approve"}</button>
                    <button disabled={busy === poc.poc_id} onClick={() => decide(poc, false)} style={{ marginLeft: 8 }}>Reject</button>
                </section>
            ))}
        </div>
    );
}
