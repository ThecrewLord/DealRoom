import { useEffect, useState } from "react";
import { getOpportunities } from "../api/opportunityApi";
import { getStakeholdersByOpportunity } from "../api/stakeholderApi";
import { ROLES } from "../auth/roles";
import { useAuth } from "../context/AuthContext";

export default function Stakeholders() {
    const { activeRole } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                setLoading(true);
                const opportunities = await getOpportunities();
                const groups = await Promise.all(opportunities.map(async (opportunity) => ({
                    opportunity,
                    stakeholders: await getStakeholdersByOpportunity(opportunity.opportunity_id).catch(() => []),
                })));
                if (mounted) setItems(groups.flatMap(({ opportunity, stakeholders }) =>
                    stakeholders.map((stakeholder) => ({ ...stakeholder, opportunity_name: opportunity.opportunity_name }))
                ));
            } catch (err) {
                if (mounted) setError(err?.response?.data?.message || "Unable to load stakeholders.");
            } finally {
                if (mounted) setLoading(false);
            }
        };
        if (activeRole === ROLES.SOLUTION_ENGINEER) load();
        return () => { mounted = false; };
    }, [activeRole]);

    if (activeRole !== ROLES.SOLUTION_ENGINEER) {
        return <div className="admin-page"><h2>Unauthorized</h2></div>;
    }

    return (
        <div className="admin-page">
            <h2>Stakeholders</h2>
            {loading && <p>Loading stakeholders…</p>}
            {error && <p className="error">{error}</p>}
            {!loading && !error && !items.length && <p>No authorized stakeholders found.</p>}
            {!loading && !error && items.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                    <table>
                        <thead><tr><th>Name</th><th>Opportunity</th><th>Role</th><th>Email</th><th>Phone</th></tr></thead>
                        <tbody>{items.map((stakeholder) => (
                            <tr key={stakeholder.stakeholder_id}>
                                <td>{stakeholder.stakeholder_name}</td>
                                <td>{stakeholder.opportunity_name}</td>
                                <td>{stakeholder.designation || "—"}</td>
                                <td>{stakeholder.email || "—"}</td>
                                <td>{stakeholder.phone || "—"}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
