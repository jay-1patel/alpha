"""Tenant management endpoints (Phase 1 of multi-tenancy).

Only platform owners — super_admins belonging to the DEFAULT tenant — may
list/create/update tenants. Company admins are scoped to their own tenant
everywhere else in the app.
"""

import logging
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import get_db_context, get_default_tenant_id, DEFAULT_TENANT_SLUG
from routes.auth import get_current_admin

logger = logging.getLogger("tenants")

router = APIRouter(prefix="/api/tenants", tags=["tenants"])


def require_platform_owner(current_admin: dict = Depends(get_current_admin)) -> dict:
    """Allow only super_admins of the default (platform) tenant."""
    if current_admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin role required")
    if current_admin.get("tenant_id") != get_default_tenant_id():
        raise HTTPException(status_code=403, detail="Only the platform owner can manage tenants")
    return current_admin


class TenantCreateRequest(BaseModel):
    name: str
    slug: str
    whatsapp_number: str = None


class TenantUpdateRequest(BaseModel):
    name: str = None
    whatsapp_number: str = None
    is_active: bool = None


_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,48}$")


@router.get("")
def list_tenants(current_admin: dict = Depends(require_platform_owner)):
    """List all tenants (platform owner only)."""
    with get_db_context() as conn:
        rows = conn.execute(
            """SELECT id, name, slug, whatsapp_number, is_active, created_at
               FROM tenants ORDER BY created_at ASC"""
        ).fetchall()
    return {
        "tenants": [
            {
                "id": r["id"],
                "name": r["name"],
                "slug": r["slug"],
                "whatsapp_number": r["whatsapp_number"],
                "is_active": bool(r["is_active"]),
                "created_at": r["created_at"],
            }
            for r in rows
        ]
    }


@router.post("")
def create_tenant(body: TenantCreateRequest, current_admin: dict = Depends(require_platform_owner)):
    """Create a new tenant (a new company on the platform)."""
    slug = (body.slug or "").strip().lower()
    if not _SLUG_RE.match(slug):
        raise HTTPException(
            status_code=400,
            detail="slug must be lowercase letters, digits and dashes (2-49 chars)",
        )
    with get_db_context() as conn:
        exists = conn.execute("SELECT 1 FROM tenants WHERE slug = ?", (slug,)).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="slug already taken")
        conn.execute(
            """INSERT INTO tenants (name, slug, whatsapp_number, is_active)
               VALUES (?, ?, ?, 1)""",
            (body.name.strip(), slug, body.whatsapp_number),
        )
        row = conn.execute("SELECT * FROM tenants WHERE slug = ?", (slug,)).fetchone()
    logger.info(f"TENANT_CREATED | slug={slug} | by={current_admin['username']}")
    return {
        "ok": True,
        "tenant": {
            "id": row["id"],
            "name": row["name"],
            "slug": row["slug"],
            "whatsapp_number": row["whatsapp_number"],
            "is_active": bool(row["is_active"]),
        },
    }


@router.patch("/{tenant_id}")
def update_tenant(
    tenant_id: int,
    body: TenantUpdateRequest,
    current_admin: dict = Depends(require_platform_owner),
):
    """Update a tenant's name / WhatsApp number / active flag."""
    updates, params = [], []
    if body.name is not None:
        updates.append("name = ?")
        params.append(body.name.strip())
    if body.whatsapp_number is not None:
        updates.append("whatsapp_number = ?")
        params.append(body.whatsapp_number)
    if body.is_active is not None:
        updates.append("is_active = ?")
        params.append(1 if body.is_active else 0)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(tenant_id)
    with get_db_context() as conn:
        cur = conn.execute(
            f"UPDATE tenants SET {', '.join(updates)} WHERE id = ?", params
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Tenant not found")
    logger.info(f"TENANT_UPDATED | id={tenant_id} | by={current_admin['username']}")
    return {"ok": True, "tenant_id": tenant_id}


@router.get("/{tenant_id}")
def get_tenant(tenant_id: int, current_admin: dict = Depends(require_platform_owner)):
    """Fetch a single tenant with a member count."""
    with get_db_context() as conn:
        row = conn.execute(
            "SELECT * FROM tenants WHERE id = ?", (tenant_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Tenant not found")
        admins = conn.execute(
            "SELECT COUNT(*) AS cnt FROM admins WHERE tenant_id = ?", (tenant_id,)
        ).fetchone()
    return {
        "tenant": {
            "id": row["id"],
            "name": row["name"],
            "slug": row["slug"],
            "whatsapp_number": row["whatsapp_number"],
            "is_active": bool(row["is_active"]),
            "created_at": row["created_at"],
            "admin_count": admins["cnt"],
        }
    }
