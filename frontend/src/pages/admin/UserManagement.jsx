import { useEffect, useMemo, useState } from "react";
import adminApi from "../../api/adminApi";
import { AVAILABLE_ROLES, ROLES } from "../../auth/roles";
import { useAuth } from "../../context/AuthContext";
import "../../styles/admin.css";

export default function UserManagement() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [editingRoles, setEditingRoles] = useState(null);
    const [editingManager, setEditingManager] = useState(null);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        try {
            setLoading(true);
            setError("");
            setUsers(await adminApi.getUsers());
        } catch (err) {
            setError(err?.response?.data?.message || "Unable to load users.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const revoke = async (user) => {
        if (user.user_id === currentUser?.user_id) return;
        if (!window.confirm(`Revoke access for ${user.full_name}?`)) return;
        try {
            setSaving(true); setError(""); setSuccess("");
            await adminApi.revoke(user.user_id);
            setSuccess(`Access revoked for ${user.full_name}.`);
            await load();
        } catch (err) {
            setError(err?.response?.data?.message || "Unable to revoke access.");
        } finally { setSaving(false); }
    };

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <div><h2>User Management</h2><p>Manage status, roles and reporting relationships. Organization is derived from roles.</p></div>
                <button type="button" onClick={load}>Refresh</button>
            </div>
            {error && <p className="error admin-message">{error}</p>}
            {success && <p className="admin-success admin-message">{success}</p>}
            {loading ? <p>Loading users…</p> : (
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Roles</th><th>Manager</th><th>Organization</th><th>Actions</th></tr></thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.user_id}>
                                    <td><strong>{user.full_name}</strong></td>
                                    <td className="breakable">{user.email}</td>
                                    <td><span className={`status-pill status-${user.status.toLowerCase()}`}>{user.status}</span></td>
                                    <td><div className="role-chips">{(user.roles || []).map((role) => <span className="role-chip" key={role}>{role}</span>)}</div></td>
                                    <td>{user.manager_name || "None"}</td>
                                    <td>{formatOrganization(user.organization)}</td>
                                    <td>
                                        <div className="admin-actions">
                                            <button type="button" onClick={() => setEditingRoles(user)}>Manage Roles</button>
                                            <button type="button" onClick={() => setEditingManager(user)} disabled={user.status !== "APPROVED" || !user.active}>Change Manager</button>
                                            {user.status === "APPROVED" && user.user_id !== currentUser?.user_id && <button type="button" className="danger-button" onClick={() => revoke(user)} disabled={saving}>Revoke</button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {editingRoles && <RoleEditorModal user={editingRoles} onClose={() => setEditingRoles(null)} onSaved={(message) => { setEditingRoles(null); setSuccess(message); load(); }} onError={setError} />}
            {editingManager && <ManagerEditorModal user={editingManager} onClose={() => setEditingManager(null)} onSaved={(message) => { setEditingManager(null); setSuccess(message); load(); }} onError={setError} />}
        </div>
    );
}

function RoleEditorModal({ user, onClose, onSaved, onError }) {
    const [roles, setRoles] = useState(user.roles || []);
    const [managerId, setManagerId] = useState(user.manager_id ?? null);
    const [candidates, setCandidates] = useState([]);
    const [candidateLoading, setCandidateLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [candidateError, setCandidateError] = useState("");

    const managerRequired = useMemo(() => roles.some((role) => [ROLES.SALES_EXECUTIVE, ROLES.SOLUTION_ENGINEER, ROLES.DELIVERY].includes(role)), [roles]);

    useEffect(() => {
        let mounted = true;
        setCandidateLoading(true); setCandidateError("");
        adminApi.getManagerCandidates(user.user_id, roles)
            .then((items) => mounted && setCandidates(items || []))
            .catch((err) => mounted && setCandidateError(err?.response?.data?.message || "Unable to load eligible managers."))
            .finally(() => mounted && setCandidateLoading(false));
        return () => { mounted = false; };
    }, [user.user_id, roles]);

    useEffect(() => {
        if (!managerRequired) setManagerId(null);
        else if (!candidates.some((candidate) => candidate.user_id === managerId)) setManagerId(null);
    }, [managerRequired, candidates, managerId]);

    const toggle = (role) => setRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);

    const save = async () => {
        if (!roles.length) { onError("At least one role is required."); return; }
        if (managerRequired && !managerId) { onError("Select a valid manager for the selected roles."); return; }
        if (!managerRequired && managerId !== null) { onError("The selected roles require No Manager."); return; }
        if (roles.includes(ROLES.ADMIN) && !user.roles.includes(ROLES.ADMIN) && !window.confirm("This gives the user full access-administration privileges. Continue?")) return;
        try {
            setSaving(true); onError("");
            await adminApi.updateRoles(user.user_id, roles, user.updated_at, managerId);
            onSaved(`Roles updated for ${user.full_name}.`);
        } catch (err) { onError(err?.response?.data?.message || "Unable to update roles."); }
        finally { setSaving(false); }
    };

    return <Modal title={`Manage Roles — ${user.full_name}`} onClose={onClose}>
        <div className="role-list modal-role-list">{AVAILABLE_ROLES.map((role) => <label key={role}><input type="checkbox" checked={roles.includes(role)} onChange={() => toggle(role)} />{role}</label>)}</div>
        <p className="derived-field"><strong>Organization:</strong> {formatOrganizationFromRoles(roles)}</p>
        <label className="field-label">Manager
            <select value={managerId ?? ""} onChange={(e) => setManagerId(e.target.value ? Number(e.target.value) : null)} disabled={candidateLoading || !managerRequired}>
                {!managerRequired && <option value="">No Manager</option>}
                {managerRequired && <option value="">Select manager</option>}
                {candidates.map((candidate) => <option key={candidate.user_id} value={candidate.user_id}>{candidate.full_name} — {candidate.email}</option>)}
            </select>
        </label>
        {candidateLoading && <small>Loading eligible managers…</small>}
        {candidateError && <p className="error">{candidateError}</p>}
        <div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button type="button" onClick={save} disabled={saving || candidateLoading}>{saving ? "Saving…" : "Save Roles"}</button></div>
    </Modal>;
}

function ManagerEditorModal({ user, onClose, onSaved, onError }) {
    const [candidates, setCandidates] = useState([]);
    const [managerId, setManagerId] = useState(user.manager_id ?? null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        adminApi.getManagerCandidates(user.user_id, user.roles || [])
            .then((items) => setCandidates(items || []))
            .catch((err) => onError(err?.response?.data?.message || "Unable to load eligible managers."))
            .finally(() => setLoading(false));
    }, [user.user_id, user.roles, onError]);

    const save = async () => {
        try {
            setSaving(true); onError("");
            await adminApi.updateManager(user.user_id, managerId, user.updated_at);
            onSaved(`Manager updated for ${user.full_name}.`);
        } catch (err) { onError(err?.response?.data?.message || "Unable to update manager."); }
        finally { setSaving(false); }
    };

    return <Modal title={`Change Manager — ${user.full_name}`} onClose={onClose}>
        <p><strong>Current Manager:</strong> {user.manager_name || "None"}</p>
        <label className="field-label">Eligible Manager
            <select value={managerId ?? ""} onChange={(e) => setManagerId(e.target.value ? Number(e.target.value) : null)} disabled={loading}>
                <option value="">No Manager</option>
                {candidates.map((candidate) => <option key={candidate.user_id} value={candidate.user_id}>{candidate.full_name} — {candidate.email}</option>)}
            </select>
        </label>
        {loading && <small>Loading eligible managers…</small>}
        <div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button type="button" onClick={save} disabled={saving || loading}>{saving ? "Saving…" : "Save Manager"}</button></div>
    </Modal>;
}

function Modal({ title, children, onClose }) {
    return <div className="admin-modal-backdrop"><div className="admin-modal" role="dialog" aria-modal="true"><div className="admin-modal-header"><h3>{title}</h3><button type="button" onClick={onClose}>×</button></div>{children}</div></div>;
}

function formatOrganization(value) { return value ? value.replaceAll("_", " ").replace("PRE SALES TECHNICAL", "Pre-Sales / Technical").replace("ADMINISTRATION", "Administration").replace("SALES", "Sales") : "—"; }
function formatOrganizationFromRoles(roles) { return formatOrganization([...new Set((roles || []).map((role) => role === ROLES.ADMIN ? "ADMINISTRATION" : [ROLES.SALES_EXECUTIVE, ROLES.SALES_MANAGER].includes(role) ? "SALES" : "PRE_SALES_TECHNICAL"))].sort().join(" + ")); }
