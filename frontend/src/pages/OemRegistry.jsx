import { useEffect, useState } from "react";
import api from "../api/axiosClient";
import { ROLES } from "../auth/roles";
import { useAuth } from "../context/AuthContext";

export default function OemRegistry() {
    const { activeRole } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let mounted = true;
        api.get("/oem/")
            .then((response) => mounted && setItems(response.data))
            .catch((err) => mounted && setError(err?.response?.data?.message || "Unable to load OEM registry."))
            .finally(() => mounted && setLoading(false));
        return () => { mounted = false; };
    }, [activeRole]);

    if (activeRole !== ROLES.SOLUTION_ENGINEER) {
        return <div className="admin-page"><h2>Unauthorized</h2></div>;
    }

    return (
        <div className="admin-page">
            <h2>OEM Registry</h2>
            <p>Read-only view of OEM partners attached to authorized accounts.</p>
            {loading && <p>Loading OEM partners…</p>}
            {error && <p className="error">{error}</p>}
            {!loading && !error && !items.length && <p>No authorized OEM partners found.</p>}
            {!loading && !error && items.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                    <table>
                        <thead><tr><th>Partner</th><th>Product</th><th>Contact</th><th>Status</th></tr></thead>
                        <tbody>{items.map((item) => (
                            <tr key={item.oem_partner_id}>
                                <td>{item.partner_name}</td>
                                <td>{item.product_name || "—"}</td>
                                <td>{item.contact_person || "—"}{item.email ? ` (${item.email})` : ""}</td>
                                <td>{item.status || "—"}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
