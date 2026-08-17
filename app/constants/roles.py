# Canonical business roles for the Deal Room application.
#
# Keep these values stable across backend JWT claims, API payloads, database
# user-role rows, and frontend role checks.

ADMIN = "Admin"
SALES_EXECUTIVE = "Sales Executive"
SALES_MANAGER = "Sales Manager"
PRE_SALES_MANAGER = "Pre-Sales Manager"
SOLUTION_ENGINEER = "Solution Engineer"
DELIVERY = "Delivery"

AVAILABLE_ROLES = [
    ADMIN,
    SALES_EXECUTIVE,
    SALES_MANAGER,
    PRE_SALES_MANAGER,
    SOLUTION_ENGINEER,
    DELIVERY,
]

DEFAULT_ROLE = SALES_EXECUTIVE


def is_valid_role(role):
    """Return True when *role* is one of the six canonical roles."""
    return role in AVAILABLE_ROLES
