import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createOpportunity, getOpportunities } from "../api/opportunityApi";
import { getAccounts } from "../api/accountApi";
import { ROLES } from "../auth/roles";
import { useAuth } from "../context/AuthContext";

export default function Opportunities() {
    const { activeRole } = useAuth();
    const navigate = useNavigate();
    const [opportunities, setOpportunities] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [form, setForm] = useState({
        account_id: "",
        opportunity_name: "",
        description: "",
        estimated_value: "",
        probability: 0,
        expected_close_date: "",
    });
    const [error, setError] = useState("");
    const [creating, setCreating] = useState(false);

    const load = async () => {
        try {
            setError("");
            setOpportunities(await getOpportunities());
            if (activeRole === ROLES.SALES_EXECUTIVE) {
                setAccounts(await getAccounts());
            }
        } catch (err) {
            setError(err.response?.data?.message || "Unable to load opportunities.");
        }
    };

    useEffect(() => { load(); }, [activeRole]);

    const submit = async (event) => {
        event.preventDefault();
        try {
            setCreating(true);
            const created = await createOpportunity({
                ...form,
                account_id: Number(form.account_id),
                estimated_value: form.estimated_value === "" ? null : form.estimated_value,
                probability: Number(form.probability || 0),
                expected_close_date: form.expected_close_date || null,
            });
            setForm({
                account_id: "", opportunity_name: "", description: "",
                estimated_value: "", probability: 0, expected_close_date: "",
            });
            navigate(`/opportunity/${created.opportunity_id}`);
        } catch (err) {
            setError(err.response?.data?.message || "Unable to create opportunity.");
        } finally {
            setCreating(false);
        }
    };

    return (
        <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h1>Opportunities</h1>
                    <p>Sales opportunities visible to the active role.</p>
                </div>
                <button onClick={load}>Refresh</button>
            </div>

            {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

            {activeRole === ROLES.SALES_EXECUTIVE && (
                <form onSubmit={submit} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, margin: "20px 0" }}>
                    <h2>Create Lead</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <select required value={form.account_id} onChange={e => setForm({...form, account_id: e.target.value})}>
                            <option value="">Select account</option>
                            {accounts.map(account => <option key={account.account_id} value={account.account_id}>{account.account_name}</option>)}
                        </select>
                        <input required minLength={2} placeholder="Opportunity name" value={form.opportunity_name} onChange={e => setForm({...form, opportunity_name: e.target.value})} />
                        <input type="number" min="0" placeholder="Estimated value" value={form.estimated_value} onChange={e => setForm({...form, estimated_value: e.target.value})} />
                        <input type="number" min="0" max="100" placeholder="Probability %" value={form.probability} onChange={e => setForm({...form, probability: e.target.value})} />
                        <input type="date" value={form.expected_close_date} onChange={e => setForm({...form, expected_close_date: e.target.value})} />
                        <input placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                    </div>
                    <button disabled={creating} style={{ marginTop: 14 }}>{creating ? "Creating..." : "Create Lead"}</button>
                </form>
            )}

            <div style={{ display: "grid", gap: 12 }}>
                {opportunities.map(opportunity => (
                    <button
                        key={opportunity.opportunity_id}
                        onClick={() => navigate(`/opportunity/${opportunity.opportunity_id}`)}
                        style={{ textAlign: "left", padding: 18, border: "1px solid #e2e8f0", borderRadius: 12, background: "white", cursor: "pointer" }}
                    >
                        <strong>{opportunity.opportunity_name}</strong>
                        <div>
                            {opportunity.current_stage?.stage_name} · {opportunity.status}
                            {opportunity.sales_owner ? ` · Owner: ${opportunity.sales_owner.full_name}` : ""}
                        </div>
                    </button>
                ))}
                {!opportunities.length && <p>No visible opportunities.</p>}
            </div>
        </div>
    );
}
