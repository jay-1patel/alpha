"""
State manager with optimistic locking for cross-worker safety.

Read-modify-write on user_states.context_json with version-based
optimistic concurrency control. Safe for SQLite WAL mode.
"""
import json
import time
import logging
from database import get_db_context

logger = logging.getLogger("state_manager")

B2C_CHECKOUT_STATES = [
    "B2C_CHECKOUT_NAME", "B2C_CHECKOUT_MOBILE", "B2C_CHECKOUT_PINCODE",
    "B2C_CHECKOUT_ADDRESS", "B2C_CHECKOUT_PAYMENT", "B2C_CHECKOUT_FINAL_CONFIRM",
    "B2C_CHECKOUT_CONFIRM", "B2C_AWAITING_QTY", "B2C_BROWSING_PRODUCTS",
    "B2C_VIEWING_PRODUCT", "B2C_VIEWING_CART",
]

B2B_CHECKOUT_STATES = [
    "DIST_ASK_NAME", "DIST_ASK_MOBILE", "DIST_ASK_ADDRESS",
    "DIST_REVIEW_ORDER", "DIST_BROWSE_PRODUCTS",
]

ALL_CHECKOUT_STATES = B2C_CHECKOUT_STATES + B2B_CHECKOUT_STATES


class OptimisticLockError(Exception):
    pass


def get_user_state(wa_id: str) -> str | None:
    """Return current state string, or None if no record."""
    try:
        with get_db_context() as conn:
            row = conn.execute(
                "SELECT state FROM user_states WHERE wa_id = ?", (wa_id,)
            ).fetchone()
            return row[0] if row else None
    except Exception as e:
        logger.error(f"get_user_state failed for {wa_id}: {e}")
        return None


def read_user_context(wa_id: str) -> tuple[dict, int]:
    """Return (context_dict, version). Empty dict + 0 if no record."""
    try:
        with get_db_context() as conn:
            row = conn.execute(
                "SELECT context_json, version FROM user_states WHERE wa_id = ?",
                (wa_id,),
            ).fetchone()
            if not row:
                return {}, 0
            ctx = json.loads(row[0]) if row[0] else {}
            return ctx, (row[1] or 0)
    except Exception as e:
        logger.error(f"read_user_context failed for {wa_id}: {e}")
        return {}, 0


def write_user_context(wa_id: str, context: dict, expected_version: int) -> bool:
    """CAS write: update only if version matches. Returns True on success."""
    try:
        with get_db_context() as conn:
            cur = conn.execute(
                "UPDATE user_states SET context_json = ?, version = version + 1, "
                "updated_at = CURRENT_TIMESTAMP WHERE wa_id = ? AND version = ?",
                (json.dumps(context), wa_id, expected_version),
            )
            return cur.rowcount > 0
    except Exception as e:
        logger.error(f"write_user_context failed for {wa_id}: {e}")
        return False


def update_context_with_retry(
    wa_id: str, update_fn, max_retries: int = 3
) -> dict:
    """
    Read-modify-write with optimistic-lock retry.

    update_fn MUST BE PURE: mutate the dict only. No WhatsApp sends,
    no DB writes, no HTTP — retries re-execute it.
    """
    for attempt in range(max_retries):
        context, version = read_user_context(wa_id)
        update_fn(context)
        if write_user_context(wa_id, context, expected_version=version):
            return context
        if attempt < max_retries - 1:
            time.sleep(0.05 * (attempt + 1))
            logger.debug(f"Lock retry {attempt + 1} for {wa_id}")
    raise OptimisticLockError(
        f"Context update failed after {max_retries} retries: {wa_id}"
    )


def save_context(wa_id: str, context: dict) -> bool:
    """Full-context write with retry. Returns False on persistent failure."""
    try:
        def apply(ctx):
            ctx.clear()
            ctx.update(context)
        update_context_with_retry(wa_id, apply)
        return True
    except OptimisticLockError:
        logger.error(f"save_context: lock failed after retries for {wa_id}")
        return False
    except Exception as e:
        logger.error(f"save_context error for {wa_id}: {e}")
        return False


def check_state_expiry(wa_id: str, context: dict, checkout_states: list,
                       state_ttl: dict) -> dict:
    """
    TTL check + retry-safe state reset.
    Returns {'expired': bool, 'message': str|None, 'context': dict}.
    """
    current_state = context.get("state")
    last_activity = context.get("last_activity_at", 0)

    if not current_state or current_state not in state_ttl:
        context["last_activity_at"] = time.time()
        return {"expired": False, "message": None, "context": context}

    if time.time() - last_activity <= state_ttl[current_state]:
        context["last_activity_at"] = time.time()
        return {"expired": False, "message": None, "context": context}

    # State expired — try to reset with retry
    has_cart = bool(context.get("cart", {}).get("items"))
    has_draft = bool(context.get("order_draft") or context.get("browsing_product_id"))

    if has_cart or has_draft:
        msg = ("⏰ Session timed out.\n\n"
               "Reply:\n• *resume* — Continue where you left off\n"
               "• *menu* — Start over")
    else:
        msg = "⏰ Session timed out. Reply *menu* to start over."

    target_state = "B2C_AWAITING_MAIN_SELECTION" if current_state.startswith("B2C_") else "B2B_MAIN_MENU"

    def reset(ctx):
        ctx["state"] = target_state
        ctx["last_activity_at"] = time.time()
        if has_cart:
            ctx["pending_checkout_expired"] = current_state
        elif has_draft:
            ctx["pending_b2b_expired"] = current_state

    try:
        final_ctx = update_context_with_retry(wa_id, reset)
        context.update(final_ctx)
    except OptimisticLockError:
        logger.error(f"State expiry reset failed for {wa_id}")

    return {"expired": True, "message": msg, "context": context}
