import { useEffect, useMemo, useState } from "react";
import adminApi from "../../api/adminApi";
import { AVAILABLE_ROLES, ROLES } from "../../auth/roles";
import "../../styles/admin.css";

export default function UserApproval() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [busy, setBusy] = useState(null);

    const loadUsers = async () => {
        try { setLoading(true); setError(""); setUsers(await adminApi.getPending()); }
        catch (err) { setError(err?.response?.data?.message || "Unable to load pending users."); }
        finally { setLoading(false); }
    };
    useEffect(() => { loadUsers(); }, []);

    const approve = async (user, roles, managerId) => {
        try {
            setBusy(user.user_id); setError(""); setSuccess("");
            await adminApi.approve(user.user_id, roles, managerId);
            setSuccess(`${user.full_name} was approved successfully.`);
            await loadUsers();
        } catch (err) { setError(err?.response?.data?.message || "Unable to approve user."); }
        finally { setBusy(null); }
    };

    return <div className="admin-page">
        <div className="admin-page-header"><div><h2>Pending Approvals</h2><p>Select final role(s) and a valid manager before approval.</p></div><button type="button" onClick={loadUsers}>Refresh</button></div>
        {error && <p className="error admin-message">{error}</p>}
        {success && <p className="admin-success admin-message">{success}</p>}
        {loading ? <p>Loading…</p> : !users.length ? <p>No users are awaiting approval.</p> : users.map((user) => <ApprovalCard key={user.user_id} user={user} busy={busy === user.user_id} onApprove={approve} />)}
    </div>;
}

function ApprovalCard({ user, busy, onApprove }) {
    const [roles, setRoles] = useState([]);
    const [managerId, setManagerId] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [candidateLoading, setCandidateLoading] = useState(false);
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
    const canApprove = roles.length > 0 && (!managerRequired || !!managerId) && !candidateLoading && !candidateError;

    return <section className="admin-user-card approval-card">
        <div className="admin-page-header"><div><h3>{user.full_name}</h3><p>{user.email}</p></div><span className="status-pill status-pending">PENDING</span></div>
        <div className="role-list modal-role-list">{AVAILABLE_ROLES.map((role) => <label key={role}><input type="checkbox" checked={roles.includes(role)} onChange={() => toggle(role)} />{role}</label>)}</div>
        <label className="field-label">Manager
            <select value={managerId ?? ""} onChange={(e) => setManagerId(e.target.value ? Number(e.target.value) : null)} disabled={candidateLoading || !managerRequired}>
                {!managerRequired && <option value="">No Manager</option>}
                {managerRequired && <option value="">Select manager</option>}
                {candidates.map((candidate) => <option key={candidate.user_id} value={candidate.user_id}>{candidate.full_name} — {candidate.email}</option>)}
            </select>
        </label>
        {candidateLoading && <small>Loading eligible managers…</small>}
        {candidateError && <p className="error">{candidateError}</p>}
        <button disabled={busy || !canApprove} onClick={() => onApprove(user, roles, managerId)}>{busy ? "Approving…" : "Approve"}</button>
    </section>;
}
