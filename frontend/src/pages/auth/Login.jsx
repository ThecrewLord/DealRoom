import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

import "../../styles/auth.css";

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            const response = await login({
                email: email.trim(),
                password,
            });

            if (response?.requires_role_selection) {
                sessionStorage.setItem(
                    "login_response",
                    JSON.stringify(response)
                );

                navigate("/select-role", {
                    replace: true,
                });

                return;
            }

            navigate(
                response.active_role === "Admin"
                    ? "/admin/approval"
                    : "/dashboard",
                {
                    replace: true,
                }
            );

        } catch (err) {
            const message =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                err?.message ||
                "Login failed.";

            if (
                message
                    .toLowerCase()
                    .includes("awaiting administrator approval")
            ) {
                navigate("/pending", {
                    replace: true,
                });
                return;
            }

            if (
                message
                    .toLowerCase()
                    .includes("revoked")
            ) {
                navigate("/revoked", {
                    replace: true,
                });
                return;
            }

            setError(message);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2>Login</h2>

                <form
                    className="auth-form"
                    onSubmit={handleSubmit}
                >
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) =>
                            setEmail(e.target.value)
                        }
                        required
                        autoComplete="email"
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) =>
                            setPassword(e.target.value)
                        }
                        required
                        autoComplete="current-password"
                    />

                    <button type="submit">
                        Login
                    </button>
                </form>

                {error && (
                    <p className="auth-error">
                        {error}
                    </p>
                )}

                <div className="auth-link">
                    <Link to="/signup">
                        Create Account
                    </Link>
                </div>
            </div>
        </div>
    );
}