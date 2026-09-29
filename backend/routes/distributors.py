import json
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_db_context
from routes.auth import get_current_admin, require_permission

logger = logging.getLogger("distributors")
router = APIRouter(prefix="/api/distributors")


# ── Pydantic models ────────────────────────────────────────────────────

class DistributorCreate(BaseModel):
    wa_id: str
    name: str = ""
    phone: str = ""
    email: str = ""
    region: str = ""
    tier: str = "Bronze"
    product_interests: list[str] = []
    sales_volume: float = 0
    last_order_value: float = 0
    outstanding_payments: float = 0
    notes: str = ""


class DistributorUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    region: str | None = None
    tier: str | None = None
    product_interests: list[str] | None = None
    sales_volume: float | None = None
    last_order_value: float | None = None
    outstanding_payments: float | None = None
    notes: str | None = None


# ── Helpers ────────────────────────────────────────────────────────────

def _row_to_dict(row) -> dict:
    d = dict(row)
    raw = d.get("product_interests", "[]")
    if isinstance(raw, str):
        try:
            d["product_interests"] = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            d["product_interests"] = []
    return d


# ── Routes ─────────────────────────────────────────────────────────────

@router.get("")
def list_distributors(
    q: str = "",
    region: str = "",
    tier: str = "",
):
    """List all distributors, with optional search / filter."""
    with get_db_context() as conn:
        clauses, params = [], []

        if q:
            clauses.append(
                "(wa_id LIKE ? OR name LIKE ? OR phone LIKE ? OR email LIKE ?)"
            )
            like = f"%{q}%"
            params.extend([like, like, like, like])

        if region:
            clauses.append("region = ?")
            params.append(region)

        if tier:
            clauses.append("tier = ?")
            params.append(tier)

        where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
        rows = conn.execute(
            f"SELECT * FROM distributors{where} ORDER BY name COLLATE NOCASE ASC",
            params,
        ).fetchall()

    return {"distributors": [_row_to_dict(r) for r in rows]}


@router.get("/count")
def distributor_count(
    region: str = "",
    tier: str = "",
    product_interest: str = "",
):
    """Count distributors matching optional segment filters.
    Used by Campaign Builder for the live 'target N distributors' preview.
    """
    with get_db_context() as conn:
        clauses, params = [], []

        if region:
            clauses.append("region = ?")
            params.append(region)

        if tier:
            clauses.append("tier = ?")
            params.append(tier)

        if product_interest:
            clauses.append("product_interests LIKE ?")
            params.append(f"%{product_interest}%")

        where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
        row = conn.execute(
            f"SELECT COUNT(*) AS cnt FROM distributors{where}", params
        ).fetchone()

    return {"count": row["cnt"] if row else 0}


@router.get("/lookup/{wa_id}")
def lookup_distributor(wa_id: str):
    """Look up a single distributor by WhatsApp ID.
    Called by the Inbox context drawer.
    """
    with get_db_context() as conn:
        row = conn.execute(
            "SELECT * FROM distributors WHERE wa_id = ?", (wa_id,)
        ).fetchone()

    if not row:
        return {"found": False, "wa_id": wa_id, "name": "", "region": "", "tier": ""}

    return {"found": True, **_row_to_dict(row)}


@router.post("")
def create_distributor(body: DistributorCreate):
    """Add a new distributor."""
    wa_id = body.wa_id.strip()

    if not wa_id:
        raise HTTPException(400, "wa_id is required")

    with get_db_context() as conn:
        existing = conn.execute(
            "SELECT 1 FROM distributors WHERE wa_id = ?", (wa_id,)
        ).fetchone()

        if existing:
            raise HTTPException(409, f"Distributor with wa_id '{wa_id}' already exists")

        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        conn.execute(
            """INSERT INTO distributors
                (wa_id, name, phone, email, region, tier, product_interests,
                 sales_volume, last_order_value, outstanding_payments, notes,
                 created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                wa_id,
                body.name,
                body.phone,
                body.email,
                body.region,
                body.tier,
                json.dumps(body.product_interests),
                body.sales_volume,
                body.last_order_value,
                body.outstanding_payments,
                body.notes,
                now,
                now,
            ),
        )

    logger.info(f"DISTRIBUTOR_CREATED | wa_id={wa_id} | name={body.name}")
    return {"ok": True, "wa_id": wa_id}


@router.put("/{wa_id}")
def update_distributor(wa_id: str, body: DistributorUpdate):
    """Update an existing distributor (partial update — only sent fields)."""
    fields, values = [], []

    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "product_interests":
            value = json.dumps(value)
        fields.append(f"{field} = ?")
        values.append(value)

    if not fields:
        raise HTTPException(400, "Nothing to update")

    fields.append("updated_at = ?")
    values.append(datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))
    values.append(wa_id)

    with get_db_context() as conn:
        result = conn.execute(
            f"UPDATE distributors SET {', '.join(fields)} WHERE wa_id = ?",
            values,
        )

        if result.rowcount == 0:
            raise HTTPException(404, f"Distributor '{wa_id}' not found")

    logger.info(f"DISTRIBUTOR_UPDATED | wa_id={wa_id}")
    return {"ok": True}


@router.delete("/{wa_id}")
def delete_distributor(wa_id: str):
    """Delete a distributor."""
    with get_db_context() as conn:
        result = conn.execute(
            "DELETE FROM distributors WHERE wa_id = ?", (wa_id,)
        )

        if result.rowcount == 0:
            raise HTTPException(404, f"Distributor '{wa_id}' not found")

    logger.info(f"DISTRIBUTOR_DELETED | wa_id={wa_id}")
    return {"ok": True}
