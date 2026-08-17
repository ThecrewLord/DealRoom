import { useEffect, useState } from "react";
import adminApi from "../../api/adminApi";
import { AVAILABLE_ROLES, ROLES } from "../../auth/roles";
import "../../styles/admin.css";

export default function RoleManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const load = async () => {
        try { setLoading(true); setError(""); setUsers(await adminApi.getUsers()); }
        catch (err) { setError(err?.response?.data?.message || "Unable to load users."); }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    return <div className="admin-page">
        <div className="admin-page-header"><div><h2>Role Management</h2><p>Add, remove or replace current roles. Manager eligibility is validated against the final role set.</p></div><button type="button" onClick={load}>Refresh</button></div>
        {error && <p className="error admin-message">{error}</p>}{success && <p className="admin-success admin-message">{success}</p>}
        {loading ? <p>Loading role assignments…</p> : users.map((user) => <RoleEditor key={user.user_id} user={user} onSaved={(message) => { setSuccess(message); load(); }} onError={setError} />)}
    </div>;
}

function RoleEditor({ user, onSaved, onError }) {
    const [roles, setRoles] = useState(user.roles || []);
    const [managerId, setManagerId] = useState(user.manager_id ?? null);
    const [candidates, setCandidates] = useState([]);
    const [loadingCandidates, setLoadingCandidates] = useState(false);
    const [saving, setSaving] = useState(false);
    const managerRequired = roles.some((role) => [ROLES.SALES_EXECUTIVE, ROLES.SOLUTION_ENGINEER, ROLES.DELIVERY].includes(role));

    useEffect(() => {
        let mounted = true;
        setLoadingCandidates(true);
        adminApi.getManagerCandidates(user.user_id, roles)
            .then((items) => mounted && setCandidates(items || []))
            .catch((err) => mounted && onError(err?.response?.data?.message || "Unable to load eligible managers."))
            .finally(() => mounted && setLoadingCandidates(false));
        return () => { mounted = false; };
    }, [user.user_id, roles, onError]);

    useEffect(() => {
        if (!managerRequired) setManagerId(null);
        else if (!candidates.some((candidate) => candidate.user_id === managerId)) setManagerId(null);
    }, [managerRequired, candidates, managerId]);

    const toggle = (role) => setRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
    const save = async () => {
        if (!roles.length) return onError("At least one role is required.");
        if (managerRequired && !managerId) return onError("Select a valid manager for the selected roles.");
        if (!managerRequired && managerId !== null) return onError("The selected roles require No Manager.");
        if (roles.includes(ROLES.ADMIN) && !user.roles.includes(ROLES.ADMIN) && !window.confirm("This gives the user full access-administration privileges. Continue?")) return;
        if (user.roles.some((r) => [ROLES.ADMIN, ROLES.SALES_MANAGER, ROLES.PRE_SALES_MANAGER].includes(r) && !roles.includes(r)) && !window.confirm("This removes a privileged role. Continue?")) return;
        try {
            setSaving(true); onError("");
            await adminApi.updateRoles(user.user_id, roles, user.updated_at, managerId);
            onSaved(`Roles updated for ${user.full_name}.`);
        } catch (err) { onError(err?.response?.data?.message || "Unable to update roles."); }
        finally { setSaving(false); }
    };

    return <section className="admin-user-card">
        <div className="admin-page-header"><div><strong>{user.full_name}</strong><div>{user.email}</div><small>{user.status}</small></div><div>{user.organization || "—"}</div></div>
        <div className="role-list modal-role-list">{AVAILABLE_ROLES.map((role) => <label key={role}><input type="checkbox" checked={roles.includes(role)} onChange={() => toggle(role)} />{role}</label>)}</div>
        <label className="field-label">Manager
            <select value={managerId ?? ""} onChange={(e) => setManagerId(e.target.value ? Number(e.target.value) : null)} disabled={loadingCandidates || !managerRequired}>
                {!managerRequired && <option value="">No Manager</option>}
                {managerRequired && <option value="">Select manager</option>}
                {candidates.map((candidate) => <option key={candidate.user_id} value={candidate.user_id}>{candidate.full_name} — {candidate.email}</option>)}
            </select>
        </label>
        <button type="button" disabled={saving || loadingCandidates} onClick={save}>{saving ? "Saving…" : "Save Roles"}</button>
    </section>;
}
