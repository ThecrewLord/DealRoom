import os

from flask_cors import CORS


def configure_cors(app):
    """Allow only explicitly configured local/frontend origins."""
    configured = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
    CORS(
        app,
        resources={r"/api/*": {"origins": origins}},
        supports_credentials=True,
    )
