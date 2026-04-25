"""Server-side plan (single ₹499/mo). Amount in paise; never trust client price."""

# One public plan: Societrack Pro (Razorpay order `plan_id` / API).
PLAN_ID = "societrack_pro"

# `public.apartments.plan_name` must satisfy DB CHECK (often allows basic|standard|premium|free_trial).
# Do not set plan_name to PLAN_ID here unless the constraint includes "societrack_pro".
APARTMENT_PLAN_NAME_DB = "premium"

PLAN: dict = {
    "amount_paise": 49900,  # ₹499
    "flat_limit": 500,
    "monthly_rupees": 499,
    "name": "Societrack Pro",
}


def get_plan(plan_id: str) -> dict:
    if plan_id != PLAN_ID:
        raise KeyError(f"Unknown plan: {plan_id}")
    return PLAN
