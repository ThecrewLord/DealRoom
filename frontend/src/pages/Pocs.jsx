import { useEffect, useState } from "react";
import { getOpportunities } from "../api/opportunityApi";
import { getPocsByOpportunity } from "../api/pocApi";
import { ROLES } from "../auth/roles";
import { useAuth } from "../context/AuthContext";

export default function Pocs() {
    const { activeRole } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                setLoading(true);
                setError("");
                const opportunities = await getOpportunities();
                const groups = await Promise.all(
                    opportunities.map(async (opportunity) => ({
                        opportunity,
                        pocs: await getPocsByOpportunity(opportunity.opportunity_id).catch(() => []),
                    }))
                );
                if (mounted) setItems(groups.flatMap(({ opportunity, pocs }) =>
                    pocs.map((poc) => ({ ...poc, opportunity_name: opportunity.opportunity_name }))
                ));
            } catch (err) {
                if (mounted) setError(err?.response?.data?.message || "Unable to load POCs.");
            } finally {
                if (mounted) setLoading(false);
            }
        };
        if ([ROLES.SOLUTION_ENGINEER, ROLES.DELIVERY].includes(activeRole)) load();
        return () => { mounted = false; };
    }, [activeRole]);

    if (![ROLES.SOLUTION_ENGINEER, ROLES.DELIVERY].includes(activeRole)) {
        return <div className="admin-page"><h2>Unauthorized</h2></div>;
    }

    return (
        <div className="admin-page">
            <h2>POC Tracker</h2>
            {loading && <p>Loading POCs…</p>}
            {error && <p className="error">{error}</p>}
            {!loading && !error && !items.length && <p>No authorized POCs found.</p>}
            {!loading && !error && items.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                    <table>
                        <thead><tr><th>POC</th><th>Opportunity</th><th>Status</th><th>Target Date</th><th>Outcome</th></tr></thead>
                        <tbody>{items.map((poc) => (
                            <tr key={poc.poc_id}>
                                <td>{poc.poc_name}</td>
                                <td>{poc.opportunity_name}</td>
                                <td>{poc.status}</td>
                                <td>{poc.target_date || "—"}</td>
                                <td>{poc.outcome || "—"}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
