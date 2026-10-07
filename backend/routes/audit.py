"""Superadmin-only query API for durable admin activity history."""

import json
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from database import _safe_audit_details, get_db
from routes.auth import get_current_admin

router = APIRouter(tags=["audit-history"])


@router.get("/api/admin/audit-history")
def list_audit_history(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    actor: str | None = Query(default=None, max_length=100),
    action: str | None = Query(default=None, max_length=80),
    category: str | None = Query(default=None, max_length=30),
    tenant_id: str | None = Query(default=None, max_length=100),
    outcome: str | None = Query(default=None, max_length=20),
    search: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=1_000_000),
    current_admin: dict = Depends(get_current_admin),
):
    if current_admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access is required")
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must not be after end_date")
    if outcome and outcome not in {"success", "failure"}:
        raise HTTPException(status_code=422, detail="outcome must be success or failure")

    where = ["datetime(created_at) >= datetime('now', '-365 days')"]
    params = []
    if start_date:
        where.append("date(created_at) >= ?")
        params.append(start_date.isoformat())
    if end_date:
        where.append("date(created_at) <= ?")
        params.append(end_date.isoformat())
    for column, value in (("actor_username", actor), ("action", action), ("tenant_id", tenant_id), ("outcome", outcome)):
        if value:
            where.append(f"{column} = ?")
            params.append(value.strip())
    if category:
        category_actions = {
            "authentication": ("login",),
            "accounts": (
                "first_admin_created", "admin_created", "admin_updated", "admin_deleted",
                "admin_password_reset", "admin_password_reset_via_otp", "password_changed",
            ),
            "tenant_setup": (
                "tenant_created", "tenant_deleted", "tenant_profile_draft_saved",
                "tenant_intent_draft_saved", "tenant_profile_published", "tenant_profile_rolled_back",
                "tenant_phone_id_bound", "tenant_webhook_secret_configured", "tenant_token_created",
                "tenant_token_revoked", "config_draft_saved", "config_draft_built", "config_published",
            ),
            "api_access": ("api_access_request_submitted", "api_access_request_reviewed"),
        }
        if category not in category_actions:
            raise HTTPException(status_code=422, detail="Unknown audit category")
        actions = category_actions[category]
        where.append(f"action IN ({', '.join('?' for _ in actions)})")
        params.extend(actions)
    if search and search.strip():
        term = f"%{search.strip()}%"
        where.append("(actor_username LIKE ? OR target_username LIKE ? OR resource_type LIKE ? OR resource_id LIKE ? OR action LIKE ?)")
        params.extend([term] * 5)
    clause = f" WHERE {' AND '.join(where)}" if where else ""

    conn = get_db()
    try:
        total = conn.execute(f"SELECT COUNT(*) FROM admin_audit_events{clause}", params).fetchone()[0]
        rows = conn.execute(
            f"""SELECT id, created_at, actor_id, actor_username, actor_role,
                       action, outcome, resource_type, resource_id, target_username,
                       tenant_id, details_json
                FROM admin_audit_events{clause}
                ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?""",
            [*params, limit, offset],
        ).fetchall()
    finally:
        conn.close()

    events = []
    for row in rows:
        event = dict(row)
        try:
            event["details"] = _safe_audit_details(json.loads(event.pop("details_json") or "{}"))
        except (json.JSONDecodeError, TypeError):
            event["details"] = {}
        events.append(event)
    return {"events": events, "total": total, "limit": limit, "offset": offset}
