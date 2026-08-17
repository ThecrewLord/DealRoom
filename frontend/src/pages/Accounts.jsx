import { useEffect, useState } from "react";
import { getAccounts } from "../api/accountApi";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../auth/roles";

export default function Accounts() {
    const { activeRole } = useAuth();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        getAccounts()
            .then((data) => mounted && setAccounts(data))
            .catch((err) => mounted && setError(err?.response?.data?.message || "Unable to load accounts."))
            .finally(() => mounted && setLoading(false));
        return () => { mounted = false; };
    }, [activeRole]);

    if (![ROLES.SALES_EXECUTIVE, ROLES.SALES_MANAGER].includes(activeRole)) {
        return <div className="admin-page"><h2>Unauthorized</h2></div>;
    }

    return (
        <div className="admin-page">
            <h2>Accounts</h2>
            {loading && <p>Loading accounts…</p>}
            {error && <p className="error">{error}</p>}
            {!loading && !error && !accounts.length && <p>No authorized accounts found.</p>}
            {!loading && !error && accounts.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                    <table>
                        <thead><tr><th>Account</th><th>Industry</th><th>Location</th><th>Website</th></tr></thead>
                        <tbody>{accounts.map((account) => (
                            <tr key={account.account_id}>
                                <td>{account.account_name}</td>
                                <td>{account.industry || "—"}</td>
                                <td>{[account.city, account.state, account.country].filter(Boolean).join(", ") || "—"}</td>
                                <td>{account.website || "—"}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
