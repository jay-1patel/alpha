"""Admin-editable dynamic config endpoints.

Provides CRUD + publish/draft semantics for scopes like:
    products, b2c_menu, b2b_menu, price_list, schemes, campaigns, faq

Published config is what the bot reads. Draft config is what admins edit.
Publishing copies the current draft to published and appends to history.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from database import (
    get_published_config,
    get_draft_config,
    save_draft_config,
    publish_config,
    get_publish_history,
    build_products_snapshot,
    get_published_products,
    get_products_by_category,
)
from routes.auth import get_current_admin, require_permission

logger = logging.getLogger("dynamic_config")
router = APIRouter(prefix="/api/admin/dynamic", tags=["dynamic-config"])


class ConfigPayload(BaseModel):
    scope: str
    snapshot: Optional[dict] = {}


VALID_SCOPES = {
    "products",
    "b2c_menu",
    "b2b_menu",
    "price_list",
    "schemes",
    "campaigns",
    "faq",
    "admin_settings",
    "branding",
}

# Default branding snapshot. Used when nothing has been published yet so the
# panel and bot never depend on a hardcoded company name.
DEFAULT_BRANDING = {
    "company_name": "Admin",
    "bot_name": "WhatsApp Bot",
    "logo_url": "",
    "about_text": "",
    "tagline": "WhatsApp Bot Management",
}


def _validate_scope(scope: str) -> None:
    if scope not in VALID_SCOPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scope '{scope}'. Valid scopes: {sorted(VALID_SCOPES)}",
        )


@router.get("/{scope}")
def get_config(
    scope: str,
    current_admin: dict = Depends(require_permission("manage_operations")),
):
    """Return published and draft snapshots for a scope."""
    _validate_scope(scope)
    published = get_published_config(scope, default=None)
    draft = get_draft_config(scope, default=None)
    return {
        "scope": scope,
        "published": published,
        "draft": draft,
        "has_draft": draft is not None,
    }


@router.put("/{scope}")
def save_config(
    scope: str,
    payload: dict,
    request: Request,
    current_admin: dict = Depends(require_permission("manage_operations")),
):
    """Save a draft snapshot for a scope. Does not affect the live bot."""
    _validate_scope(scope)
    snapshot = payload if isinstance(payload, dict) else payload.get("snapshot", {})
    username = current_admin.get("username", "")
    ok = save_draft_config(scope, snapshot, updated_by=username)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to save draft")
    logger.info(f"DRAFT_SAVED | scope={scope} | by={username}")
    return {"ok": True, "scope": scope, "has_draft": True}


@router.post("/{scope}/build-draft")
def build_draft(
    scope: str,
    current_admin: dict = Depends(require_permission("manage_operations")),
):
    """Regenerate the draft snapshot from the current DB rows (products only)."""
    _validate_scope(scope)
    if scope != "products":
        raise HTTPException(
            status_code=400,
            detail=f"build-draft is only supported for scope 'products'",
        )
    snapshot = build_products_snapshot()
    username = current_admin.get("username", "")
    ok = save_draft_config(scope, snapshot, updated_by=username)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to save draft")
    logger.info(f"DRAFT_BUILT | scope={scope} | by={username}")
    return {"ok": True, "scope": scope, "has_draft": True}


@router.post("/{scope}/publish")
def publish(
    scope: str,
    current_admin: dict = Depends(require_permission("manage_operations")),
):
    """Publish the current draft snapshot so the bot picks it up."""
    _validate_scope(scope)
    username = current_admin.get("username", "")

    # For products, the canonical draft is auto-generated from the products table.
    if scope == "products":
        snapshot = build_products_snapshot()
        save_draft_config(scope, snapshot, updated_by=username)

    ok = publish_config(scope, published_by=username)
    if not ok:
        raise HTTPException(
            status_code=400,
            detail=f"No draft exists for scope '{scope}' to publish",
        )
    logger.info(f"PUBLISHED | scope={scope} | by={username}")
    return {"ok": True, "scope": scope, "published": True}


# ── Convenience: published products for the bot ───────────────────────────

@router.get("/products/feed")
def products_feed(
    category: Optional[str] = None,
    limit: int = 100,
):
    """Public-ish feed of published products (used by bot workflows)."""
    return {"products": get_published_products(category=category, limit=limit)}


@router.get("/{scope}/history")
def history(
    scope: str,
    limit: int = 20,
    current_admin: dict = Depends(require_permission("manage_operations")),
):
    """Return recent publish events for a scope."""
    _validate_scope(scope)
    return {"scope": scope, "history": get_publish_history(scope, limit=limit)}


# ── Public branding (login page needs it before auth) ─────────────────────
# NOTE: A separate router is used because the main router requires the
# manage_operations permission on every endpoint; branding must be readable
# unauthenticated so the login screen can render the tenant's logo/name.
from fastapi import APIRouter as _APIRouter  # noqa: E402

public_router = APIRouter(prefix="/api/branding", tags=["branding"])


@public_router.get("")
def get_public_branding():
    """Return the published branding snapshot, merged over defaults.

    Public endpoint: the login/forgot-password pages need the company name
    and logo before an admin token exists.
    """
    published = get_published_config("branding", default=None) or {}
    merged = {**DEFAULT_BRANDING, **(published or {})}
    return merged
