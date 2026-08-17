import { useEffect, useState } from "react";
import adminApi from "../../api/adminApi";
import { useAuth } from "../../context/AuthContext";

export default function AccessManagement() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [filter, setFilter] = useState("ALL");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            setLoading(true);
            setError("");
            setUsers(await adminApi.getUsers());
        } catch (e) {
            setError(e?.response?.data?.message || "Unable to load users.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const visible = users.filter((u) => filter === "ALL" || u.status === filter);
    const revoke = async (user) => {
        if (!window.confirm(`Revoke access for ${user.full_name}?`)) return;
        try {
            setError("");
            setSuccess("");
            await adminApi.revoke(user.user_id);
            setSuccess(`Access revoked for ${user.full_name}.`);
            await load();
        } catch (e) {
            setError(e?.response?.data?.message || "Unable to revoke access.");
        }
    };

    return (
        <div className="admin-page">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2>Access Management</h2>
                <button onClick={load}>Refresh</button>
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="ALL">All</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REVOKED">Revoked</option>
            </select>
            {loading && <p>Loading access records…</p>}
            {error && <p className="error">{error}</p>}
            {success && <p>{success}</p>}
            {!loading && !error && <div style={{ overflowX: "auto" }}><table>
                <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Roles</th><th>Manager</th><th>Access</th></tr></thead>
                <tbody>{visible.map((u) => (
                    <tr key={u.user_id}>
                        <td>{u.full_name}</td><td>{u.email}</td><td>{u.status}</td><td>{(u.roles || []).join(", ") || "—"}</td><td>{u.manager_name || "None"}</td>
                        <td>{u.status === "APPROVED" && u.user_id !== currentUser?.user_id && <button onClick={() => revoke(u)}>Revoke</button>}</td>
                    </tr>
                ))}</tbody>
            </table></div>}
        </div>
    );
}
