import json
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_db_context

logger = logging.getLogger("campaigns")
router = APIRouter(prefix="/api/campaigns")


# ── Pydantic models ────────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    name: str = ""
    status: str = "draft"
    audience_type: str = "all"
    segment: dict | None = None
    target_count: int = 0
    template_type: str = "plain_text"
    message_template: str = ""
    template_variables: dict = {}
    buttons: list = []
    list_items: list = []
    media_filename: str | None = None
    schedule_mode: str = "now"
    scheduled_at: str | None = None
    timezone: str = "Asia/Kolkata"


class AudienceSegment(BaseModel):
    segment: dict | None = None


# ── Helpers ────────────────────────────────────────────────────────────

def _row_to_dict(row) -> dict:
    d = dict(row)

    for key in ("segment_json", "template_variables_json", "buttons_json", "list_items_json"):
        raw = d.get(key, "{}")
        if isinstance(raw, str):
            try:
                d[key.replace("_json", "")] = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                d[key.replace("_json", "")] = {} if "var" in key or "segment" in key else []
        else:
            d[key.replace("_json", "")] = raw

    # Nest metrics fields to match frontend Campaign type
    d["metrics"] = {
        "sent": d.pop("sent", 0) or 0,
        "delivered": d.pop("delivered", 0) or 0,
        "read": d.pop("read_count", 0) or 0,
        "replied": d.pop("replied", 0) or 0,
        "failed": d.pop("failed", 0) or 0,
    }

    return d


def _estimate_target_count(conn, segment: dict | None) -> int:
    """Count distributors matching the segment filters."""
    if not segment:
        row = conn.execute("SELECT COUNT(*) AS cnt FROM distributors").fetchone()
        return row["cnt"] if row else 0

    clauses, params = [], []

    regions = segment.get("regions", [])
    if regions and "All" not in regions:
        placeholders = ",".join("?" for _ in regions)
        clauses.append(f"region IN ({placeholders})")
        params.extend(regions)

    tiers = segment.get("tiers", [])
    if tiers:
        placeholders = ",".join("?" for _ in tiers)
        clauses.append(f"tier IN ({placeholders})")
        params.extend(tiers)

    interests = segment.get("product_interests", [])
    for interest in interests:
        clauses.append("product_interests LIKE ?")
        params.append(f"%{interest}%")

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    row = conn.execute(f"SELECT COUNT(*) AS cnt FROM distributors{where}", params).fetchone()
    return row["cnt"] if row else 0


# ── GET /api/campaigns — list + stats ──────────────────────────────────

@router.get("")
def list_campaigns():
    with get_db_context() as conn:
        rows = conn.execute(
            "SELECT * FROM campaigns ORDER BY created_at DESC"
        ).fetchall()

        campaigns = [_row_to_dict(r) for r in rows]

        # Stats: last 24h
        cutoff = (datetime.utcnow() - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")
        stats_row = conn.execute(
            """SELECT
                COALESCE(SUM(sent), 0) AS total_sent_24h,
                COUNT(CASE WHEN status = 'sending' OR status = 'scheduled' THEN 1 END) AS active_campaigns
            FROM campaigns WHERE created_at >= ?""",
            (cutoff,),
        ).fetchone()

        total_sent = stats_row["total_sent_24h"] if stats_row else 0
        active = stats_row["active_campaigns"] if stats_row else 0

        # Overall rates from all campaigns with data
        rate_row = conn.execute(
            """SELECT
                COALESCE(SUM(sent), 0) AS all_sent,
                COALESCE(SUM(delivered), 0) AS all_delivered,
                COALESCE(SUM(read_count), 0) AS all_read,
                COALESCE(SUM(replied), 0) AS all_replied
            FROM campaigns"""
        ).fetchone()

        all_sent = rate_row["all_sent"] if rate_row else 0
        all_delivered = rate_row["all_delivered"] if rate_row else 0
        all_replied = rate_row["all_replied"] if rate_row else 0

        delivery_rate = round((all_delivered / all_sent * 100), 1) if all_sent else 0
        reply_rate = round((all_replied / all_sent * 100), 1) if all_sent else 0

    return {
        "campaigns": campaigns,
        "stats": {
            "total_sent_24h": total_sent,
            "delivery_rate": delivery_rate,
            "reply_rate": reply_rate,
            "active_campaigns": active,
        },
    }


# ── POST /api/campaigns — create ──────────────────────────────────────

@router.post("")
def create_campaign(body: CampaignCreate):
    with get_db_context() as conn:
        target = _estimate_target_count(conn, body.segment)

        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        cursor = conn.execute(
            """INSERT INTO campaigns
                (name, status, audience_type, segment_json, target_count,
                 template_type, message_template, template_variables_json,
                 buttons_json, list_items_json, media_filename,
                 schedule_mode, scheduled_at, timezone, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                body.name,
                body.status,
                body.audience_type,
                json.dumps(body.segment or {}),
                target,
                body.template_type,
                body.message_template,
                json.dumps(body.template_variables),
                json.dumps(body.buttons),
                json.dumps(body.list_items),
                body.media_filename,
                body.schedule_mode,
                body.scheduled_at,
                body.timezone,
                now,
                now,
            ),
        )

        campaign_id = cursor.lastrowid

    logger.info(f"CAMPAIGN_CREATED | id={campaign_id} | name={body.name}")
    return {"ok": True, "id": campaign_id}


# ── PUT /api/campaigns/{id} — update ──────────────────────────────────

@router.put("/{campaign_id}")
def update_campaign(campaign_id: int, body: CampaignCreate):
    with get_db_context() as conn:
        target = _estimate_target_count(conn, body.segment)

        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        result = conn.execute(
            """UPDATE campaigns SET
                name = ?, status = ?, audience_type = ?, segment_json = ?,
                target_count = ?, template_type = ?, message_template = ?,
                template_variables_json = ?, buttons_json = ?, list_items_json = ?,
                media_filename = ?, schedule_mode = ?, scheduled_at = ?,
                timezone = ?, updated_at = ?
            WHERE id = ?""",
            (
                body.name,
                body.status,
                body.audience_type,
                json.dumps(body.segment or {}),
                target,
                body.template_type,
                body.message_template,
                json.dumps(body.template_variables),
                json.dumps(body.buttons),
                json.dumps(body.list_items),
                body.media_filename,
                body.schedule_mode,
                body.scheduled_at,
                body.timezone,
                now,
                campaign_id,
            ),
        )

        if result.rowcount == 0:
            raise HTTPException(404, f"Campaign {campaign_id} not found")

    logger.info(f"CAMPAIGN_UPDATED | id={campaign_id}")
    return {"ok": True}


# ── DELETE /api/campaigns/{id} ────────────────────────────────────────

@router.delete("/{campaign_id}")
def delete_campaign(campaign_id: int):
    with get_db_context() as conn:
        result = conn.execute("DELETE FROM campaigns WHERE id = ?", (campaign_id,))

        if result.rowcount == 0:
            raise HTTPException(404, f"Campaign {campaign_id} not found")

    logger.info(f"CAMPAIGN_DELETED | id={campaign_id}")
    return {"ok": True}


# ── POST /api/campaigns/{id}/duplicate ────────────────────────────────

@router.post("/{campaign_id}/duplicate")
def duplicate_campaign(campaign_id: int):
    with get_db_context() as conn:
        row = conn.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,)).fetchone()

        if not row:
            raise HTTPException(404, f"Campaign {campaign_id} not found")

        d = dict(row)
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        cursor = conn.execute(
            """INSERT INTO campaigns
                (name, status, audience_type, segment_json, target_count,
                 template_type, message_template, template_variables_json,
                 buttons_json, list_items_json, media_filename,
                 schedule_mode, scheduled_at, timezone, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                f"{d['name']} (copy)",
                "draft",
                d["audience_type"],
                d["segment_json"],
                d["target_count"],
                d["template_type"],
                d["message_template"],
                d["template_variables_json"],
                d["buttons_json"],
                d["list_items_json"],
                d["media_filename"],
                d["schedule_mode"],
                None,
                d["timezone"],
                now,
                now,
            ),
        )

        new_id = cursor.lastrowid

    logger.info(f"CAMPAIGN_DUPLICATED | from={campaign_id} → to={new_id}")
    return {"ok": True, "id": new_id}


# ── POST /api/campaigns/audience/count ────────────────────────────────

@router.post("/audience/count")
def audience_count(body: AudienceSegment):
    with get_db_context() as conn:
        count = _estimate_target_count(conn, body.segment)

    return {"count": count}


# ── GET /api/campaigns/{id}/metrics ───────────────────────────────────

@router.get("/{campaign_id}/metrics")
def campaign_metrics(campaign_id: int):
    with get_db_context() as conn:
        row = conn.execute(
            "SELECT * FROM campaigns WHERE id = ?", (campaign_id,)
        ).fetchone()

        if not row:
            raise HTTPException(404, f"Campaign {campaign_id} not found")

        d = dict(row)

    return {
        "campaign_id": campaign_id,
        "status": d["status"],
        "progress": {
            "sent": d["sent"],
            "total": d["target_count"],
        },
        "funnel": {
            "sent": d["sent"],
            "delivered": d["delivered"],
            "read": d["read_count"],
            "replied": d["replied"],
        },
    }


# ── GET /api/campaigns/{id}/replies ───────────────────────────────────

@router.get("/{campaign_id}/replies")
def campaign_replies(campaign_id: int):
    with get_db_context() as conn:
        rows = conn.execute(
            """SELECT wa_id, name, reply_text, replied_at
            FROM campaign_replies
            WHERE campaign_id = ?
            ORDER BY replied_at DESC""",
            (campaign_id,),
        ).fetchall()

    return {"replies": [dict(r) for r in rows]}
