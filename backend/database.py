import os
import json
import sqlite3
import logging
import hashlib
from datetime import datetime, timedelta, timezone
from contextlib import contextmanager

logger = logging.getLogger("leeway_webhook")

# ── Fix 1: Hardcode DB_PATH using absolute paths ─────────────────────────
# Get the directory that this database.py file is located in
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# The repo-root faq.db is the single populated database shared by the app,
# the FAQ bot, and the KB bot (routing.config reads the same file).
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DB_PATH = os.path.join(PROJECT_ROOT, "faq.db")


# ── Fix 2: Remove the routing.config import (it crashes if .env is missing) ──
# DELETE THIS LINE: from routing.config import DB_PATH

# ── Helpers ──────────────────────────────────────────────────────────────

def _ensure_columns(conn, table, columns):
    existing = {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    for col_name, col_type in columns:
        if col_name not in existing:
            try:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}")
                logger.info(f"Added column {col_name} {col_type} to {table}")
            except Exception as e:
                logger.error(f"Failed to add column {col_name} to {table}: {e}")


def _loads_json(value, default=None):
    try:
        return json.loads(value) if value else (default if default is not None else {})
    except (json.JSONDecodeError, TypeError):
        return default if default is not None else {}


# ── Multi-tenancy: default tenant helpers ───────────────────────────────────
# Every row created before multi-tenancy belongs to this implicit tenant.
# get_default_tenant_id() creates it lazily so existing DBs keep working.
DEFAULT_TENANT_SLUG = "default"


def get_default_tenant_id() -> int:
    """Return the id of the default tenant, creating it on first use.

    Keeps single-tenant deployments (the legacy behaviour) fully working:
    rows without an explicit tenant_id are treated as belonging to this
    tenant.
    """
    with get_db_context() as conn:
        row = conn.execute(
            "SELECT id FROM tenants WHERE slug = ?", (DEFAULT_TENANT_SLUG,)
        ).fetchone()
        if row:
            return row["id"]
        conn.execute(
            """INSERT INTO tenants (name, slug, is_active, created_at)
               VALUES (?, ?, 1, CURRENT_TIMESTAMP)""",
            ("Default Tenant", DEFAULT_TENANT_SLUG),
        )
        return conn.execute(
            "SELECT id FROM tenants WHERE slug = ?", (DEFAULT_TENANT_SLUG,)
        ).fetchone()["id"]


def get_tenant_id_for_admin(username: str) -> int:
    """Resolve the tenant an admin belongs to (falls back to default)."""
    with get_db_context() as conn:
        row = conn.execute(
            "SELECT tenant_id FROM admins WHERE username = ?", (username,)
        ).fetchone()
    if row and row["tenant_id"]:
        return row["tenant_id"]
    return get_default_tenant_id()


# ── Connection helpers ───────────────────────────────────────────────────

def get_db():
    # Uses the absolute path we defined at the top of the file
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_db_context():
    conn = get_db()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


# ── Schema ───────────────────────────────────────────────────────────────

def init_db():
    with get_db_context() as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
        # ── Multi-tenancy: every company gets a row here ──────────────────
        conn.execute(
            """CREATE TABLE IF NOT EXISTS tenants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                whatsapp_number TEXT,
                whatsapp_credentials_json TEXT DEFAULT '{}',
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )

        conn.execute(
            """CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wa_id TEXT NOT NULL,
                sender_name TEXT,
                message TEXT NOT NULL,
                response TEXT,
                route TEXT DEFAULT 'faq',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        # Migrate older DBs that predate the route column
        chat_cols = [r[1] for r in conn.execute("PRAGMA table_info(chat_history)")]
        if "route" not in chat_cols:
            conn.execute("ALTER TABLE chat_history ADD COLUMN route TEXT DEFAULT 'faq'")
            # Backfill from the "[route] message" prefix used by save_chat
            conn.execute(
                """UPDATE chat_history
                   SET route = LOWER(SUBSTR(message, 2, INSTR(message, ']') - 2))
                   WHERE message LIKE '[%]%' AND INSTR(message, ']') > 2"""
            )
        # SECURITY FIX: Store payload hash instead of raw payload to prevent sensitive data leakage
        conn.execute(
            """CREATE TABLE IF NOT EXISTS webhook_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                direction TEXT NOT NULL,
                endpoint TEXT,
                payload_hash TEXT,
                payload_size INTEGER,
                status_code INTEGER,
                notes TEXT,
                response_time_ms INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS faq_dataset (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_file TEXT NOT NULL,
                content_type TEXT NOT NULL,
                content TEXT NOT NULL,
                page_number INTEGER DEFAULT 1,
                embedding BLOB,
                media_url TEXT,
                media_type TEXT,
                module TEXT NOT NULL DEFAULT 'faq'
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS knowledge_base (
                id INTEGER PRIMARY KEY,
                title TEXT,
                category TEXT,
                content TEXT NOT NULL,
                tags TEXT,
                source TEXT,
                chunks_json TEXT,
                embedding_blob BLOB
            )"""
        )
        _ensure_columns(conn, "knowledge_base", [
            ("chunks_json", "TEXT"),
            ("embedding_blob", "BLOB"),
            ("created_at", "TIMESTAMP"),
            ("media_url", "TEXT"),
            ("media_type", "TEXT"),
        ])
        conn.execute(
            """CREATE TABLE IF NOT EXISTS incoming_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT UNIQUE,
                number TEXT NOT NULL,
                message TEXT,
                status TEXT DEFAULT 'received',
                raw_payload TEXT,
                fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS cached_embeddings (
                chunk_index INTEGER PRIMARY KEY,
                source_name TEXT,
                source_id INTEGER,
                chunk_text TEXT,
                metadata_json TEXT,
                embedding_blob BLOB
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS user_sessions (
                wa_id TEXT PRIMARY KEY,
                last_inbound_at TIMESTAMP,
                last_outbound_at TIMESTAMP,
                session_open INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                category TEXT DEFAULT 'general',
                description TEXT,
                short_description TEXT,
                price TEXT,
                mrp TEXT,
                unit TEXT DEFAULT 'piece',
                moq TEXT,
                media_url TEXT,
                media_type TEXT DEFAULT 'image',
                ingredients TEXT DEFAULT '[]',
                is_active INTEGER DEFAULT 1,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        _ensure_columns(conn, "products", [
            ("ingredients", "TEXT DEFAULT '[]'"),
            ("variants_json", "TEXT"),
            ("updated_at", "TIMESTAMP"),
            ("bulk_discount_tiers", "TEXT"),
            ("embedding", "BLOB"),
        ])
        conn.execute(
            """CREATE TABLE IF NOT EXISTS user_states (
                wa_id TEXT PRIMARY KEY,
                state TEXT DEFAULT 'MAIN_MENU',
                context_json TEXT DEFAULT '{}',
                lang TEXT DEFAULT 'en',
                version INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (wa_id) REFERENCES user_sessions(wa_id) ON DELETE CASCADE
            )"""
        )
        _ensure_columns(conn, "user_states", [("version", "INTEGER DEFAULT 0")])
        conn.execute(
            """CREATE TABLE IF NOT EXISTS complaints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id TEXT UNIQUE NOT NULL,
                wa_id TEXT,
                complaint_type TEXT DEFAULT 'Other',
                description TEXT DEFAULT '',
                status TEXT DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_number TEXT UNIQUE NOT NULL,
                wa_id TEXT,
                items TEXT DEFAULT '[]',
                total_amount REAL DEFAULT 0,
                status TEXT DEFAULT 'placed',
                payment_status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT,
                role TEXT DEFAULT 'sub_admin',
                permissions TEXT DEFAULT '{}',
                recovery_key TEXT,
                tenant_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS admin_otps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                otp_code TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS admin_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                ext TEXT,
                module TEXT DEFAULT 'kb',
                size INTEGER DEFAULT 0,
                doc_id INTEGER,
                file_path TEXT,
                url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        try:
            conn.execute("ALTER TABLE admin_files ADD COLUMN url TEXT")
        except Exception:
            pass
        conn.execute(
            """CREATE TABLE IF NOT EXISTS admin_chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                sender TEXT,
                username TEXT,
                message TEXT NOT NULL,
                text TEXT,
                attachment_json TEXT,
                deleted_for TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        conn.execute(
            """CREATE INDEX IF NOT EXISTS idx_admin_chat_created_at ON admin_chat_messages(created_at)"""
        )
        conn.execute(
            """CREATE INDEX IF NOT EXISTS idx_admin_chat_chat_id ON admin_chat_messages(chat_id)"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS deleted_chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(message_id, username)
            )"""
        )
        try:
            conn.execute("ALTER TABLE deleted_chat_messages ADD COLUMN message TEXT")
        except Exception:
            pass
        conn.execute(
            """CREATE INDEX IF NOT EXISTS idx_deleted_msg_id ON deleted_chat_messages(message_id)"""
        )
        # Inbox: agent status tracking
        conn.execute(
            """CREATE TABLE IF NOT EXISTS agent_status (
                agent_id TEXT PRIMARY KEY,
                status TEXT DEFAULT 'offline',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        # Migration: older DBs created agent_status with "username" column
        try:
            cols = [r[1] for r in conn.execute("PRAGMA table_info(agent_status)").fetchall()]
            if "agent_id" not in cols and "username" in cols:
                conn.execute("ALTER TABLE agent_status RENAME COLUMN username TO agent_id")
        except Exception:
            pass
        # Inbox: conversation-to-agent assignments
        conn.execute(
            """CREATE TABLE IF NOT EXISTS conversation_assignments (
                wa_id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS whatsapp_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                category TEXT DEFAULT 'UTILITY',
                subcategory TEXT DEFAULT 'custom',
                header_type TEXT DEFAULT 'noheader',
                header_text TEXT,
                body_template TEXT NOT NULL,
                footer TEXT DEFAULT '',
                buttons_json TEXT DEFAULT '[]',
                params_json TEXT DEFAULT '[]',
                language TEXT DEFAULT 'en',
                template_for TEXT DEFAULT 'sales',
                status TEXT DEFAULT 'registered',
                send2_response TEXT,
                registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS session_buttons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                button_id TEXT UNIQUE NOT NULL,
                wa_id TEXT,
                session_id TEXT,
                button_type TEXT NOT NULL,
                label TEXT NOT NULL,
                payload_json TEXT DEFAULT '{}',
                state TEXT DEFAULT 'MAIN_MENU',
                lang TEXT DEFAULT 'en',
                expires_at TIMESTAMP,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                triggered_at TIMESTAMP
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS button_clicks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                button_id TEXT NOT NULL,
                wa_id TEXT NOT NULL,
                session_id TEXT,
                button_type TEXT,
                label TEXT,
                payload_json TEXT DEFAULT '{}',
                source TEXT DEFAULT 'whatsapp',
                metadata_json TEXT DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )

        # ── Distributors (B2B contacts / CRM) ────────────────────────────────
        conn.execute(
            """CREATE TABLE IF NOT EXISTS distributors (
                wa_id       TEXT PRIMARY KEY,
                name        TEXT NOT NULL DEFAULT '',
                phone       TEXT DEFAULT '',
                email       TEXT DEFAULT '',
                region      TEXT DEFAULT '',
                tier        TEXT DEFAULT 'Bronze',
                product_interests TEXT DEFAULT '[]',
                sales_volume      REAL DEFAULT 0,
                last_order_value  REAL DEFAULT 0,
                outstanding_payments REAL DEFAULT 0,
                notes       TEXT DEFAULT '',
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )

        # ── Campaigns ──────────────────────────────────────────────────────────
        conn.execute(
            """CREATE TABLE IF NOT EXISTS campaigns (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                name            TEXT NOT NULL DEFAULT '',
                status          TEXT NOT NULL DEFAULT 'draft',
                audience_type   TEXT NOT NULL DEFAULT 'all',
                segment_json    TEXT DEFAULT '{}',
                target_count    INTEGER DEFAULT 0,
                template_type   TEXT NOT NULL DEFAULT 'plain_text',
                message_template TEXT NOT NULL DEFAULT '',
                template_variables_json TEXT DEFAULT '{}',
                buttons_json    TEXT DEFAULT '[]',
                list_items_json TEXT DEFAULT '[]',
                media_filename  TEXT,
                schedule_mode   TEXT NOT NULL DEFAULT 'now',
                scheduled_at    TEXT,
                timezone        TEXT DEFAULT 'Asia/Kolkata',
                sent            INTEGER DEFAULT 0,
                delivered       INTEGER DEFAULT 0,
                read_count      INTEGER DEFAULT 0,
                replied         INTEGER DEFAULT 0,
                failed          INTEGER DEFAULT 0,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )

        conn.execute(
            """CREATE TABLE IF NOT EXISTS campaign_replies (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL,
                wa_id       TEXT NOT NULL,
                name        TEXT DEFAULT '',
                reply_text  TEXT NOT NULL DEFAULT '',
                replied_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
            )"""
        )

        # Migration: add columns if missing
        _ensure_columns(conn, "admins", [
            ("permissions", "TEXT DEFAULT '{}'"),
            ("recovery_key", "TEXT"),
            ("salt", "TEXT"),
            ("tenant_id", "INTEGER"),
            ("role", "TEXT DEFAULT 'sub_admin'"),
            ("email", "TEXT"),
            ("updated_at", "TIMESTAMP"),
        ])
        _ensure_columns(conn, "admin_chat_messages", [
            ("deleted_for", "TEXT"),
            ("sender", "TEXT"),
            ("text", "TEXT"),
            ("attachment_json", "TEXT"),
        ])
        _ensure_columns(conn, "faq_dataset", [
            ("media_url", "TEXT"),
            ("media_type", "TEXT"),
            ("module", "TEXT NOT NULL DEFAULT 'faq'"),
        ])

        _ensure_columns(conn, "products", [
            ("media_url", "TEXT"),
            ("media_type", "TEXT DEFAULT 'image'"),
        ])

        _ensure_columns(conn, "knowledge_base", [
            ("media_url", "TEXT"),
            ("media_type", "TEXT"),
        ])

        _ensure_columns(conn, "webhook_logs", [
            ("response_time_ms", "INTEGER"),
        ])

        # B2C support: auto-escalation flag on the user state
        _ensure_columns(conn, "user_states", [
            ("human_handover", "INTEGER DEFAULT 0"),
        ])

        # Timestamp marking when a human session was closed/resolved. NULL while a
        # conversation is (or was never) in human mode; set when control returns
        # to the bot so the live inbox can drop resolved conversations.
        _ensure_columns(conn, "user_states", [
            ("handover_resolved_at", "TIMESTAMP"),
        ])

        conn.execute(
            "UPDATE knowledge_base SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"
        )

        # Migrate old admins table: add password_hash column if missing (from old backend schema)
        _ensure_columns(conn, "admins", [
            ("password_hash", "TEXT NOT NULL DEFAULT ''"),
        ])

        # Migrate admin_chat_messages: ensure 'message' column exists for backward compat
        _ensure_columns(conn, "admin_chat_messages", [
            ("message", "TEXT NOT NULL DEFAULT ''"),
        ])
        # -- B2B Distributor migrations (orders / complaints / products) --
        _ensure_columns(conn, "orders", [
            ("source", "TEXT DEFAULT 'whatsapp'"),
            ("tier", "TEXT DEFAULT 'Bronze'"),
            ("discount_applied", "REAL DEFAULT 0"),
            ("delivery_date", "TEXT"),
        ])
        _ensure_columns(conn, "complaints", [
            ("priority", "TEXT DEFAULT 'normal'"),
            ("assigned_to", "TEXT"),
            ("updated_at", "TIMESTAMP"),
            ("resolved_at", "TIMESTAMP"),
            ("subject", "TEXT"),
        ])
        _ensure_columns(conn, "products", [
            ("bulk_discount_tiers", "TEXT DEFAULT '[]'"),
            ("nutritional_facts", "TEXT DEFAULT ''"),
            ("variants_json", "TEXT DEFAULT '[]'"),
            ("updated_at", "TIMESTAMP"),
            ("embedding", "BLOB"),
        ])

        # ── Admin-editable WhatsApp menus ────────────────────────────────────
        # Item IDs are load-bearing: FSM workflows dispatch on exact ids.
        # Only title/description/section/icon/sort_order/is_active are editable.
        # A stale legacy `menus` table (payload/action_type shape, unused by any
        # current code) is renamed rather than dropped so no data is lost.
        _legacy = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='menus'"
        ).fetchone()
        if _legacy:
            _cols = [r[1] for r in conn.execute("PRAGMA table_info(menus)").fetchall()]
            if "menu_key" not in _cols:
                conn.execute("ALTER TABLE menus RENAME TO menus_legacy")
        conn.execute(
            """CREATE TABLE IF NOT EXISTS menus (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                menu_key    TEXT NOT NULL,
                item_id     TEXT NOT NULL,
                title       TEXT NOT NULL DEFAULT '',
                description TEXT DEFAULT '',
                section     TEXT DEFAULT 'General',
                icon        TEXT DEFAULT '',
                sort_order  INTEGER DEFAULT 0,
                is_active   INTEGER DEFAULT 1,
                updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(menu_key, item_id)
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS menu_settings (
                menu_key   TEXT PRIMARY KEY,
                header     TEXT DEFAULT '',
                body       TEXT DEFAULT '',
                footer     TEXT DEFAULT '',
                button_text TEXT DEFAULT '',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )

        # ── Admin-editable dynamic config (publish/draft model) ───────────────
        # Generic staging + publishing for products, price_list, schemes, faq,
        # campaigns, and any other admin-editable JSON snapshots. The published
        # row is what the bot reads; the draft row is what admins edit.
        conn.execute(
            """CREATE TABLE IF NOT EXISTS published_config (
                scope      TEXT PRIMARY KEY,
                snapshot_json TEXT NOT NULL DEFAULT '{}',
                published_by  TEXT DEFAULT '',
                published_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS draft_config (
                scope      TEXT PRIMARY KEY,
                snapshot_json TEXT NOT NULL DEFAULT '{}',
                updated_by    TEXT DEFAULT '',
                updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS publish_history (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                scope         TEXT NOT NULL,
                snapshot_json TEXT NOT NULL DEFAULT '{}',
                published_by  TEXT DEFAULT '',
                published_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )

        # ── Unified cart & checkout (Phase 1) ────────────────────────────────
        # One active cart per user. Totals are COMPUTED on read, never stored.
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute(
            """CREATE TABLE IF NOT EXISTS carts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wa_id TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('utc')),
                updated_at TEXT NOT NULL DEFAULT (datetime('utc')),
                expires_at TEXT NOT NULL
            )"""
        )
        conn.execute("CREATE INDEX IF NOT EXISTS ix_carts_expires ON carts(expires_at)")
        conn.execute(
            """CREATE TABLE IF NOT EXISTS cart_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL,
                qty INTEGER NOT NULL CHECK (qty > 0),
                price_at_add REAL NOT NULL,
                added_at TEXT NOT NULL DEFAULT (datetime('utc')),
                UNIQUE (cart_id, product_id)
            )"""
        )
        conn.execute("CREATE INDEX IF NOT EXISTS ix_cart_items_cart ON cart_items(cart_id)")

        # Back-compat: the old run_b2c_migration.py schema created cart_items
        # without added_at and without a UNIQUE(cart_id, product_id) constraint
        # that cart_service relies on for its upsert. Reconcile in place.
        _cart_cols = {r[1] for r in conn.execute("PRAGMA table_info(cart_items)").fetchall()}
        if "added_at" not in _cart_cols:
            conn.execute("ALTER TABLE cart_items ADD COLUMN added_at TEXT")
            if "created_at" in _cart_cols:
                conn.execute(
                    "UPDATE cart_items SET added_at = created_at WHERE added_at IS NULL"
                )
            conn.execute(
                "UPDATE cart_items SET added_at = datetime('now') WHERE added_at IS NULL"
            )
            logger.info("Added column added_at to cart_items (legacy schema reconcile)")
        try:
            conn.execute(
                """DELETE FROM cart_items
                   WHERE rowid NOT IN (
                       SELECT MIN(rowid) FROM cart_items
                       GROUP BY cart_id, product_id
                   )"""
            )
            conn.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_cart_items_cart_product "
                "ON cart_items(cart_id, product_id)"
            )
        except Exception as e:
            logger.error(f"Failed to create unique index on cart_items: {e}")
        conn.execute(
            """CREATE TABLE IF NOT EXISTS checkout_sessions (
                id TEXT PRIMARY KEY,
                wa_id TEXT NOT NULL,
                cart_snapshot_json TEXT NOT NULL,
                order_draft_json TEXT NOT NULL DEFAULT '{}',
                status TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','processing','confirmed','cancelled','expired')),
                state TEXT DEFAULT 'name',
                created_at TEXT NOT NULL DEFAULT (datetime('utc')),
                expires_at TEXT NOT NULL,
                confirmed_order_number TEXT
            )"""
        )
        conn.execute("CREATE INDEX IF NOT EXISTS ix_checkout_wa ON checkout_sessions(wa_id, status)")
        _ensure_columns(conn, "checkout_sessions", [("state", "TEXT DEFAULT 'name'")])

        # ── Orders: idempotency + per-user history index (Phase 2) ──────────
        _ensure_columns(conn, "orders", [("idempotency_key", "TEXT")])
        conn.execute(
            """CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_idempotency_key
               ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL"""
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS ix_orders_wa_created ON orders(wa_id, created_at)"
        )
        # Products: optional stock tracking (NULL = untracked).
        _ensure_columns(conn, "products", [("stock_quantity", "INTEGER")])
        # ── Multi-tenancy Phase 1: tenant_id on all core tables ─────────────
        # Must run AFTER the CREATE TABLE statements above. NULL = default
        # tenant (legacy rows); get_default_tenant_id() resolves NULLs.
        TENANT_TABLES = [
            "products", "faq_dataset", "knowledge_base", "user_states",
            "user_sessions", "orders", "complaints", "campaigns",
            "distributors", "menus", "whatsapp_templates",
        ]
        for table in TENANT_TABLES:
            _ensure_columns(conn, table, [("tenant_id", "INTEGER")])


# ── Generic publish/draft config helpers ──────────────────────────────────

def get_published_config(scope: str, default=None):
    """Return the published JSON snapshot for a scope, or default."""
    with get_db_context() as conn:
        row = conn.execute(
            "SELECT snapshot_json FROM published_config WHERE scope = ?", (scope,)
        ).fetchone()
    if not row or not row["snapshot_json"]:
        return default if default is not None else None
    return _loads_json(row["snapshot_json"])


def get_draft_config(scope: str, default=None):
    """Return the draft JSON snapshot for a scope, or default."""
    with get_db_context() as conn:
        row = conn.execute(
            "SELECT snapshot_json FROM draft_config WHERE scope = ?", (scope,)
        ).fetchone()
    if not row or not row["snapshot_json"]:
        return default if default is not None else None
    return _loads_json(row["snapshot_json"])


def save_draft_config(scope: str, snapshot: dict, updated_by: str = "") -> bool:
    """Save a draft snapshot for a scope. Does not affect the live bot."""
    payload = json.dumps(snapshot)
    with get_db_context() as conn:
        conn.execute(
            """INSERT INTO draft_config (scope, snapshot_json, updated_by, updated_at)
               VALUES (?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT(scope) DO UPDATE SET
                   snapshot_json = excluded.snapshot_json,
                   updated_by = excluded.updated_by,
                   updated_at = CURRENT_TIMESTAMP""",
            (scope, payload, updated_by),
        )
    return True


def publish_config(scope: str, published_by: str = "") -> bool:
    """Copy the current draft to published and append to history.

    If no draft exists, the published config is left unchanged.
    """
    with get_db_context() as conn:
        draft = conn.execute(
            "SELECT snapshot_json FROM draft_config WHERE scope = ?", (scope,)
        ).fetchone()
        if not draft:
            return False
        snapshot_json = draft["snapshot_json"]
        conn.execute(
            """INSERT INTO published_config (scope, snapshot_json, published_by, published_at)
               VALUES (?, ?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT(scope) DO UPDATE SET
                   snapshot_json = excluded.snapshot_json,
                   published_by = excluded.published_by,
                   published_at = excluded.published_at""",
            (scope, snapshot_json, published_by),
        )
        conn.execute(
            "INSERT INTO publish_history (scope, snapshot_json, published_by, published_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
            (scope, snapshot_json, published_by),
        )
    return True


def get_publish_history(scope: str, limit: int = 20) -> list:
    """Return recent publish events for a scope, newest first."""
    with get_db_context() as conn:
        rows = conn.execute(
            """SELECT id, scope, snapshot_json, published_by, published_at
                 FROM publish_history
                WHERE scope = ?
                ORDER BY published_at DESC
                LIMIT ?""",
            (scope, limit),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "scope": r["scope"],
            "snapshot": _loads_json(r["snapshot_json"]),
            "published_by": r["published_by"],
            "published_at": r["published_at"],
        }
        for r in rows
    ]

def invalidate_menu_cache():
    """Clear the in-process menu cache (called after admin edits)."""
    try:
        from services.menu_catalog import invalidate_menu_cache as _inv
        _inv()
    except Exception:
        pass


def get_menu_items(menu_key: str, active_only: bool = True) -> list:
    """Rows for one menu, ordered. Empty list when menu not in DB."""
    sql = ("SELECT menu_key, item_id, title, description, section, icon, "
           "sort_order, is_active FROM menus WHERE menu_key = ?")
    if active_only:
        sql += " AND is_active = 1"
    sql += " ORDER BY sort_order ASC, id ASC"
    with get_db_context() as conn:
        rows = conn.execute(sql, (menu_key,)).fetchall()
    return [
        {"menu_key": r[0], "item_id": r[1], "title": r[2], "description": r[3],
         "section": r[4], "icon": r[5], "sort_order": r[6], "is_active": r[7]}
        for r in rows
    ]


def upsert_menu_item(menu_key: str, item_id: str, **fields) -> bool:
    """Insert or update one menu item. item_id/menu_key are immutable keys."""
    allowed = {"title", "description", "section", "icon", "sort_order", "is_active"}
    data = {k: v for k, v in fields.items() if k in allowed}
    if not data:
        return False
    sets = ", ".join(f"{k} = ?" for k in data)
    with get_db_context() as conn:
        conn.execute(
            f"""INSERT INTO menus (menu_key, item_id, {", ".join(data)})
                VALUES (?, ?, {", ".join("?" for _ in data)})
                ON CONFLICT(menu_key, item_id) DO UPDATE SET
                {sets}, updated_at = CURRENT_TIMESTAMP""",
            (menu_key, item_id, *data.values(), *data.values()),
        )
    return True


def reset_menu(menu_key: str) -> int:
    """Delete DB overrides for one menu; loader falls back to code defaults."""
    with get_db_context() as conn:
        cur = conn.execute("DELETE FROM menus WHERE menu_key = ?", (menu_key,))
    invalidate_menu_cache()
    return cur.rowcount


def delete_menu_item(menu_key: str, item_id: str) -> bool:
    """Delete a single menu item row. Returns True if a row was removed."""
    with get_db_context() as conn:
        cur = conn.execute(
            "DELETE FROM menus WHERE menu_key = ? AND item_id = ?",
            (menu_key, item_id),
        )
    invalidate_menu_cache()
    return cur.rowcount > 0


def get_menu_settings(menu_key: str) -> dict:
    with get_db_context() as conn:
        row = conn.execute(
            "SELECT header, body, footer, button_text FROM menu_settings WHERE menu_key = ?",
            (menu_key,),
        ).fetchone()
    if not row:
        return {}
    return {"header": row[0] or "", "body": row[1] or "",
            "footer": row[2] or "", "button_text": row[3] or ""}


def set_menu_settings(menu_key: str, **fields) -> bool:
    allowed = {"header", "body", "footer", "button_text"}
    data = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not data:
        return False
    cols = ", ".join(data)
    sets = ", ".join(f"{k} = ?" for k in data)
    with get_db_context() as conn:
        conn.execute(
            f"""INSERT INTO menu_settings (menu_key, {cols})
                VALUES (?, {", ".join("?" for _ in data)})
                ON CONFLICT(menu_key) DO UPDATE SET
                {sets}, updated_at = CURRENT_TIMESTAMP""",
            (menu_key, *data.values(), *data.values()),
        )
    return True


# ── Webhook logging ──────────────────────────────────────────────────────

WEBHOOK_LOG_MAX_ROWS = 5000


def log_webhook(direction, endpoint, payload, status_code=None, notes=None, response_time_ms=None):
    # SECURITY FIX: Store payload hash instead of raw payload to prevent sensitive data leakage
    try:
        payload_str = json.dumps(payload) if not isinstance(payload, str) else payload
        # Compute hash of the payload for secure storage
        payload_hash = hashlib.sha256(payload_str.encode('utf-8', errors='replace')).hexdigest()
        payload_size = len(payload_str)
        with get_db_context() as conn:
            conn.execute(
                "INSERT INTO webhook_logs (direction, endpoint, payload_hash, payload_size, status_code, notes, response_time_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (direction, endpoint, payload_hash, payload_size, status_code, notes, response_time_ms, datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
            )
            _trim_webhook_logs(conn)
    except Exception as e:
        logger.error(f"Failed to log webhook: {e}")


def _trim_webhook_logs(conn, max_rows: int = WEBHOOK_LOG_MAX_ROWS):
    try:
        count = conn.execute("SELECT COUNT(*) FROM webhook_logs").fetchone()[0]
        if count > max_rows:
            excess = count - max_rows
            conn.execute(
                "DELETE FROM webhook_logs WHERE id IN "
                "(SELECT id FROM webhook_logs ORDER BY created_at ASC, id ASC LIMIT ?)",
                (excess,),
            )
    except Exception as e:
        logger.error(f"Failed to trim webhook_logs: {e}")


def get_webhook_stats():
    with get_db_context() as conn:
        total = conn.execute("SELECT COUNT(*) as cnt FROM webhook_logs").fetchone()["cnt"]
        incoming = conn.execute("SELECT COUNT(*) as cnt FROM webhook_logs WHERE direction = 'incoming'").fetchone()["cnt"]
        outgoing = conn.execute("SELECT COUNT(*) as cnt FROM webhook_logs WHERE direction = 'outgoing'").fetchone()["cnt"]
        last_in = conn.execute("SELECT created_at FROM webhook_logs WHERE direction = 'incoming' ORDER BY created_at DESC LIMIT 1").fetchone()
        last_out = conn.execute("SELECT created_at FROM webhook_logs WHERE direction = 'outgoing' ORDER BY created_at DESC LIMIT 1").fetchone()
        return {
            "total": total,
            "incoming": incoming,
            "outgoing": outgoing,
            "last_incoming": last_in["created_at"] if last_in else None,
            "last_outgoing": last_out["created_at"] if last_out else None,
        }


# ── Chat history ─────────────────────────────────────────────────────────

def save_chat(wa_id, sender_name, message, response, route="faq"):
    with get_db_context() as conn:
        conn.execute(
            "INSERT INTO chat_history (wa_id, sender_name, message, response, route, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (wa_id, sender_name, f"[{route}] {message}", response, route, datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        )


def get_recent_history(wa_id: str, limit: int = 5, ttl_minutes: int = 30):
    with get_db_context() as conn:
        rows = conn.execute(
            "SELECT message, response, created_at FROM chat_history "
            "WHERE wa_id = ? ORDER BY created_at DESC LIMIT ?",
            (wa_id, limit),
        ).fetchall()
    if not rows:
        return []
    rows.reverse()
    last = rows[-1]
    try:
        now = datetime.now(timezone.utc)
        last_time = datetime.strptime(last["created_at"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        if (now - last_time).total_seconds() > ttl_minutes * 60:
            return []
    except Exception:
        pass
    return [
        {"user": row["message"], "assistant": row["response"]}
        for row in rows
    ]


# ── FAQ dataset helpers ─────────────────────────────────────────────────

def save_embeddings(embedding_data):
    with get_db_context() as conn:
        for faq_id, embedding_bytes in embedding_data:
            conn.execute(
                "UPDATE faq_dataset SET embedding = ? WHERE id = ?",
                (embedding_bytes, faq_id),
            )


def save_chunks(chunks, module="faq", media_url=None, media_type=None):
    with get_db_context() as conn:
        for chunk in chunks:
            conn.execute(
                "INSERT INTO faq_dataset (source_file, content_type, content, page_number, module, media_url, media_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (chunk["source_file"], chunk["content_type"], chunk["content"], chunk["page_number"], module, media_url, media_type),
            )


def save_knowledge_base_chunks(chunks, source_file, media_url=None, media_type=None):
    from collections import defaultdict
    grouped = defaultdict(list)
    for chunk in chunks:
        grouped[chunk.get("source_file", source_file)].append(chunk)

    with get_db_context() as conn:
        for src, group in grouped.items():
            texts = [c.get("content", "") for c in group if c.get("content")]
            full_text = "\n".join(texts)
            conn.execute(
                """INSERT INTO knowledge_base (title, category, content, tags, source, chunks_json, embedding_blob, created_at, media_url, media_type)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    src,
                    "uploaded",
                    full_text,
                    json.dumps([]),
                    src,
                    json.dumps(texts),
                    None,
                    datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    media_url,
                    media_type,
                ),
            )


def get_files_summary():
    with get_db_context() as conn:
        rows = conn.execute(
            "SELECT source_file, module, COUNT(*) as chunk_count FROM faq_dataset GROUP BY source_file ORDER BY source_file"
        ).fetchall()
        return [dict(r) for r in rows]


def delete_file_chunks(source_file):
    with get_db_context() as conn:
        result = conn.execute("DELETE FROM faq_dataset WHERE source_file = ?", (source_file,))
        return result.rowcount


def delete_knowledge_base_file(source_file):
    with get_db_context() as conn:
        result = conn.execute("DELETE FROM knowledge_base WHERE source = ?", (source_file,))
        return result.rowcount


# ── Session management (24-hour WhatsApp session window) ─────────────────

def update_session_inbound(wa_id: str):
    with get_db_context() as conn:
        conn.execute(
            """INSERT INTO user_sessions (wa_id, last_inbound_at, session_open)
               VALUES (?, CURRENT_TIMESTAMP, 1)
               ON CONFLICT(wa_id) DO UPDATE SET
                 last_inbound_at = CURRENT_TIMESTAMP,
                 session_open = 1""",
            (wa_id,),
        )


def update_session_outbound(wa_id: str):
    with get_db_context() as conn:
        conn.execute(
            """INSERT INTO user_sessions (wa_id, last_outbound_at)
               VALUES (?, CURRENT_TIMESTAMP)
               ON CONFLICT(wa_id) DO UPDATE SET
                 last_outbound_at = CURRENT_TIMESTAMP""",
            (wa_id,),
        )


def is_session_open(wa_id: str, window_hours: int = 24) -> bool:
    with get_db_context() as conn:
        row = conn.execute(
            "SELECT last_inbound_at FROM user_sessions WHERE wa_id = ?",
            (wa_id,),
        ).fetchone()
    if not row or not row["last_inbound_at"]:
        return False
    try:
        last = datetime.strptime(row["last_inbound_at"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        return (now - last).total_seconds() < window_hours * 3600
    except Exception:
        return False


def get_session_info(wa_id: str) -> dict:
    with get_db_context() as conn:
        row = conn.execute(
            "SELECT * FROM user_sessions WHERE wa_id = ?",
            (wa_id,),
        ).fetchone()
    return dict(row) if row else {}


# ── Product helpers ──────────────────────────────────────────────────────

def save_product(name: str, slug: str, category: str = "general",
                 description: str = "", short_description: str = "",
                 price: str = "", mrp: str = "", unit: str = "piece",
                 moq: str = "", media_url: str = None, media_type: str = "image",
                  ingredients: list = None, sort_order: int = 0,
                 variants_json: list = None,
                  stock_quantity: int = None, nutritional_facts: str = None,
                 bulk_discount_tiers: list = None) -> int:
    with get_db_context() as conn:
        cur = conn.execute(
            """INSERT INTO products (name, slug, category, description, short_description,
               price, mrp, unit, moq, media_url, media_type, ingredients, sort_order, variants_json,
               stock_quantity, nutritional_facts, bulk_discount_tiers, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)""",
            (name, slug, category, description, short_description,
              price, mrp, unit, moq, media_url, media_type, json.dumps(ingredients or []), sort_order,
             json.dumps(variants_json or []),
              stock_quantity, nutritional_facts, json.dumps(bulk_discount_tiers or [])),
        )
        return cur.lastrowid


def get_product(product_id: int) -> dict:
    with get_db_context() as conn:
        row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    return _deserialize_product(dict(row)) if row else None


def get_product_by_slug(slug: str) -> dict:
    with get_db_context() as conn:
        row = conn.execute("SELECT * FROM products WHERE slug = ?", (slug,)).fetchone()
    return _deserialize_product(dict(row)) if row else None


def list_products(category: str = None, active_only: bool = True, limit: int = 100) -> list:
    query = "SELECT * FROM products WHERE 1=1"
    params = []
    if active_only:
        query += " AND is_active = 1"
    if category:
        query += " AND category = ?"
        params.append(category)
    query += " ORDER BY sort_order ASC, created_at DESC LIMIT ?"
    params.append(limit)
    with get_db_context() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_deserialize_product(dict(r)) for r in rows]


def _deserialize_product(row: dict) -> dict:
    """JSON-decode list fields on a product row."""
    row["ingredients"] = _loads_json(row.get("ingredients"), [])
    row["variants_json"] = _loads_json(row.get("variants_json"), [])
    row["bulk_discount_tiers"] = _loads_json(row.get("bulk_discount_tiers"), [])
    return row


def update_product(product_id: int, **kwargs) -> bool:
    allowed = {"name", "slug", "category", "description", "short_description",
               "price", "mrp", "unit", "moq", "media_url", "media_type",
               "ingredients", "is_active", "sort_order", "variants_json",
               "stock_quantity", "nutritional_facts", "bulk_discount_tiers"}
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if not updates:
        return False
    if "ingredients" in updates and isinstance(updates["ingredients"], list):
        updates["ingredients"] = json.dumps(updates["ingredients"])
    if "variants_json" in updates and isinstance(updates["variants_json"], list):
        updates["variants_json"] = json.dumps(updates["variants_json"])
    if "bulk_discount_tiers" in updates and isinstance(updates["bulk_discount_tiers"], list):
        updates["bulk_discount_tiers"] = json.dumps(updates["bulk_discount_tiers"])
    updates["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [product_id]
    with get_db_context() as conn:
        conn.execute(f"UPDATE products SET {set_clause} WHERE id = ?", values)
    return True


def delete_product(product_id: int, hard: bool = False) -> bool:
    with get_db_context() as conn:
        if hard:
            conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
        else:
            conn.execute("UPDATE products SET is_active = 0 WHERE id = ?", (product_id,))
    return True


def search_products(query: str, limit: int = 20) -> list:
    import re as _re

    def _words_match(a, b):
        if a == b:
            return True
        if len(a) >= 4 and len(b) >= 4:
            if a.startswith(b) or b.startswith(a):
                return True
            if a in b or b in a:
                return True
        return False

    words = [w for w in _re.findall(r"[a-zA-Z]{2,}", query.lower())]
    if not words:
        return []

    # Try FAISS vector search first
    try:
        from kb.services.rag import search_products_faiss
        faiss_results = search_products_faiss(query, limit=limit)
        if faiss_results:
            ids = [r["product_id"] for r in faiss_results]
            placeholders = ",".join("?" * len(ids))
            with get_db_context() as conn:
                rows = conn.execute(
                    f"SELECT * FROM products WHERE id IN ({placeholders}) AND is_active = 1",
                    ids,
                ).fetchall()
            if rows:
                row_map = {dict(r)["id"]: dict(r) for r in rows}
                return [row_map[pid] for pid in ids if pid in row_map]
    except Exception:
        pass

    # Fallback: keyword search
    with get_db_context() as conn:
        rows = conn.execute(
            """SELECT * FROM products
                WHERE is_active = 1 AND (name LIKE ? OR description LIKE ? OR ingredients LIKE ? OR category LIKE ?)
               ORDER BY sort_order ASC LIMIT ?""",
            (f"%{query}%", f"%{query}%", f"%{query}%", f"%{query}%", limit),
        ).fetchall()
        if rows:
            return [dict(r) for r in rows]
        all_rows = conn.execute(
            "SELECT * FROM products WHERE is_active = 1"
        ).fetchall()
        scored = []
        for r in all_rows:
            d = _deserialize_product(dict(r))
            pname = (d.get("name") or "").lower()
            _ingredients = d.get("ingredients") or ""
            if isinstance(_ingredients, list):
                _ingredients = " ".join(_ingredients)
            searchable = " ".join([
                pname,
                (d.get("description") or "").lower(),
                _ingredients.lower(),
                (d.get("category") or "").lower(),
            ])
            product_words = [w for w in pname.split() if len(w) > 2]
            score = 0
            for w in words:
                if w in searchable:
                    score += 2
                else:
                    for pw in product_words:
                        if _words_match(w, pw):
                            score += 1
                            break
            if score > 0:
                scored.append((score, d))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [d for _, d in scored[:limit]]


def get_products_by_category(category: str, limit: int = 50) -> list:
    with get_db_context() as conn:
        rows = conn.execute(
            """SELECT * FROM products
               WHERE is_active = 1 AND category = ?
               ORDER BY sort_order ASC LIMIT ?""",
            (category, limit),
        ).fetchall()
    return [_deserialize_product(dict(r)) for r in rows]


def get_published_products(category: str = None, active_only: bool = True, limit: int = 100) -> list:
    """Return products from the published config snapshot, falling back to DB."""
    published = get_published_config("products")
    if published and isinstance(published, dict) and "items" in published:
        items = published["items"]
        if active_only:
            items = [p for p in items if p.get("is_active", True)]
        if category:
            items = [p for p in items if p.get("category") == category]
        items = sorted(
            items,
            key=lambda p: (p.get("sort_order", 0), p.get("created_at", "")),
        )
        return items[:limit]
    # Fallback: read directly from DB if nothing is published yet.
    return list_products(category=category, active_only=active_only, limit=limit)


def build_products_snapshot(category: str = None, active_only: bool = True) -> dict:
    """Build the canonical products snapshot from DB rows."""
    items = list_products(category=category, active_only=active_only, limit=500)
    return {"items": items, "count": len(items), "generated_at": datetime.now().isoformat()}

def get_user_state(wa_id: str) -> dict:
    with get_db_context() as conn:
        row = conn.execute(
            "SELECT * FROM user_states WHERE wa_id = ?",
            (wa_id,),
        ).fetchone()
    if row:
        result = dict(row)
        try:
            result["context_json"] = json.loads(result.get("context_json") or "{}")
        except (json.JSONDecodeError, TypeError):
            result["context_json"] = {}
        return result
    return {"wa_id": wa_id, "state": "MAIN_MENU", "context_json": {}, "lang": "en"}


def set_user_state(wa_id: str, state: str, context: dict = None, lang: str = None) -> bool:
    with get_db_context() as conn:
        context_json = json.dumps(context or {})
        if lang:
            conn.execute(
                """INSERT INTO user_states (wa_id, state, context_json, lang)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT(wa_id) DO UPDATE SET
                     state = ?,
                     context_json = ?,
                     lang = ?,
                     updated_at = CURRENT_TIMESTAMP""",
                (wa_id, state, context_json, lang, state, context_json, lang),
            )
        else:
            conn.execute(
                """INSERT INTO user_states (wa_id, state, context_json)
                   VALUES (?, ?, ?)
                   ON CONFLICT(wa_id) DO UPDATE SET
                     state = ?,
                     context_json = ?,
                     updated_at = CURRENT_TIMESTAMP""",
                (wa_id, state, context_json, state, context_json),
            )
    return True


def update_user_context(wa_id: str, context: dict) -> bool:
    current = get_user_state(wa_id)
    merged = {**current.get("context_json", {}), **context}
    return set_user_state(wa_id, current.get("state", "MAIN_MENU"), merged)


def clear_user_context(wa_id: str) -> bool:
    return set_user_state(wa_id, "MAIN_MENU", {})


def set_human_handover(wa_id: str, active: bool) -> bool:
    """Set or clear the human-handover state for a conversation.

    When ``active`` is True the conversation enters the live human inbox and any
    previous "resolved" marker is cleared. When False the human session is
    terminated, control returns to the bot, and ``handover_resolved_at`` is
    stamped so the live inbox stops showing the conversation.
    """
    try:
        with get_db_context() as conn:
            if active:
                conn.execute(
                    """
                    INSERT INTO user_states (wa_id, human_handover, updated_at, handover_resolved_at)
                    VALUES (?, 1, CURRENT_TIMESTAMP, NULL)
                    ON CONFLICT(wa_id) DO UPDATE SET
                        human_handover = 1,
                        updated_at = CURRENT_TIMESTAMP,
                        handover_resolved_at = NULL
                    """,
                    (wa_id,),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO user_states (wa_id, human_handover, updated_at, handover_resolved_at)
                    VALUES (?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT(wa_id) DO UPDATE SET
                        human_handover = 0,
                        updated_at = CURRENT_TIMESTAMP,
                        handover_resolved_at = CURRENT_TIMESTAMP
                    """,
                    (wa_id,),
                )
        return True
    except Exception as e:
        logger.error(f"set_human_handover failed for {wa_id}: {e}")
        return False


# ── WhatsApp Template helpers ────────────────────────────────────────────

def save_template(name: str, data: dict) -> int:
    with get_db_context() as conn:
        existing = conn.execute(
            "SELECT id FROM whatsapp_templates WHERE name = ?", (name,)
        ).fetchone()
        if existing:
            conn.execute(
                """UPDATE whatsapp_templates SET
                    category = ?, subcategory = ?, header_type = ?,
                    header_text = ?, body_template = ?, footer = ?,
                    buttons_json = ?, params_json = ?, language = ?,
                    template_for = ?, status = ?, send2_response = ?,
                    updated_at = CURRENT_TIMESTAMP
                   WHERE name = ?""",
                (
                    data.get("category", "UTILITY"),
                    data.get("subcategory", "custom"),
                    data.get("header_type", "noheader"),
                    data.get("header_text", ""),
                    data.get("body_template", ""),
                    data.get("footer", ""),
                    json.dumps(data.get("buttons", [])),
                    json.dumps(data.get("params", [])),
                    data.get("language", "en"),
                    data.get("template_for", "sales"),
                    data.get("status", "registered"),
                    data.get("send2_response", ""),
                    name,
                ),
            )
            return existing["id"]
        else:
            cur = conn.execute(
                """INSERT INTO whatsapp_templates
                    (name, category, subcategory, header_type, header_text,
                     body_template, footer, buttons_json, params_json,
                     language, template_for, status, send2_response)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    name,
                    data.get("category", "UTILITY"),
                    data.get("subcategory", "custom"),
                    data.get("header_type", "noheader"),
                    data.get("header_text", ""),
                    data.get("body_template", ""),
                    data.get("footer", ""),
                    json.dumps(data.get("buttons", [])),
                    json.dumps(data.get("params", [])),
                    data.get("language", "en"),
                    data.get("template_for", "sales"),
                    data.get("status", "registered"),
                    data.get("send2_response", ""),
                ),
            )
            return cur.lastrowid


def get_template(name: str) -> dict:
    with get_db_context() as conn:
        row = conn.execute(
            "SELECT * FROM whatsapp_templates WHERE name = ?", (name,)
        ).fetchone()
    if row:
        result = dict(row)
        try:
            result["buttons_json"] = json.loads(result.get("buttons_json") or "[]")
        except (json.JSONDecodeError, TypeError):
            result["buttons_json"] = []
        try:
            result["params_json"] = json.loads(result.get("params_json") or "[]")
        except (json.JSONDecodeError, TypeError):
            result["params_json"] = []
        return result
    return None


def list_templates(status: str = None, category: str = None, limit: int = 50) -> list:
    query = "SELECT * FROM whatsapp_templates WHERE 1=1"
    params = []
    if status:
        query += " AND status = ?"
        params.append(status)
    if category:
        query += " AND category = ?"
        params.append(category)
    query += " ORDER BY updated_at DESC LIMIT ?"
    params.append(limit)
    with get_db_context() as conn:
        rows = conn.execute(query, params).fetchall()
    results = []
    for r in rows:
        d = dict(r)
        try:
            d["buttons_json"] = json.loads(d.get("buttons_json") or "[]")
        except (json.JSONDecodeError, TypeError):
            d["buttons_json"] = []
        results.append(d)
    return results


def delete_template(name: str) -> bool:
    with get_db_context() as conn:
        conn.execute("DELETE FROM whatsapp_templates WHERE name = ?", (name,))
    return True


# ── Session Button helpers ───────────────────────────────────────────────

def save_session_button(button_id: str, wa_id: str = None, session_id: str = None,
                        button_type: str = "quick", label: str = "",
                        payload: dict = None, state: str = "MAIN_MENU",
                        lang: str = "en", expires_at: str = None) -> int:
    payload_json = json.dumps(payload or {})
    with get_db_context() as conn:
        existing = conn.execute(
            "SELECT id FROM session_buttons WHERE button_id = ?", (button_id,)
        ).fetchone()
        if existing:
            conn.execute(
                """UPDATE session_buttons SET
                    wa_id = ?, session_id = ?, button_type = ?, label = ?,
                    payload_json = ?, state = ?, lang = ?,
                    expires_at = ?, is_active = 1, triggered_at = NULL
                   WHERE button_id = ?""",
                (wa_id, session_id, button_type, label, payload_json,
                 state, lang, expires_at, button_id),
            )
            return existing["id"]
        else:
            cur = conn.execute(
                """INSERT INTO session_buttons
                    (button_id, wa_id, session_id, button_type, label,
                     payload_json, state, lang, expires_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (button_id, wa_id, session_id, button_type, label,
                 payload_json, state, lang, expires_at),
            )
            return cur.lastrowid


def get_session_button(button_id: str) -> dict:
    with get_db_context() as conn:
        row = conn.execute(
            "SELECT * FROM session_buttons WHERE button_id = ?", (button_id,)
        ).fetchone()
    if row:
        result = dict(row)
        try:
            result["payload_json"] = json.loads(result.get("payload_json") or "{}")
        except (json.JSONDecodeError, TypeError):
            result["payload_json"] = {}
        return result
    return None


def list_session_buttons(wa_id: str = None, state: str = None,
                         is_active: bool = True, limit: int = 50) -> list:
    query = "SELECT * FROM session_buttons WHERE 1=1"
    params = []
    if wa_id:
        query += " AND wa_id = ?"
        params.append(wa_id)
    if state:
        query += " AND state = ?"
        params.append(state)
    if is_active:
        query += " AND is_active = 1"
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    with get_db_context() as conn:
        rows = conn.execute(query, params).fetchall()
    results = []
    for r in rows:
        d = dict(r)
        try:
            d["payload_json"] = json.loads(d.get("payload_json") or "{}")
        except (json.JSONDecodeError, TypeError):
            d["payload_json"] = {}
        results.append(d)
    return results


def deactivate_session_button(button_id: str) -> bool:
    with get_db_context() as conn:
        conn.execute(
            "UPDATE session_buttons SET is_active = 0 WHERE button_id = ?",
            (button_id,),
        )
    return True


def trigger_session_button(button_id: str, wa_id: str) -> bool:
    with get_db_context() as conn:
        conn.execute(
            "UPDATE session_buttons SET triggered_at = CURRENT_TIMESTAMP WHERE button_id = ?",
            (button_id,),
        )
    return True


# ── Button Click helpers ─────────────────────────────────────────────────

def log_button_click(button_id: str, wa_id: str, session_id: str = None,
                     button_type: str = None, label: str = None,
                     payload: dict = None, source: str = "whatsapp",
                     metadata: dict = None) -> int:
    with get_db_context() as conn:
        cur = conn.execute(
            """INSERT INTO button_clicks
                (button_id, wa_id, session_id, button_type, label,
                 payload_json, source, metadata_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (button_id, wa_id, session_id, button_type, label,
             json.dumps(payload or {}), source, json.dumps(metadata or {})),
        )
        return cur.lastrowid


def get_button_clicks(button_id: str = None, wa_id: str = None,
                      limit: int = 50) -> list:
    query = "SELECT * FROM button_clicks WHERE 1=1"
    params = []
    if button_id:
        query += " AND button_id = ?"
        params.append(button_id)
    if wa_id:
        query += " AND wa_id = ?"
        params.append(wa_id)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    with get_db_context() as conn:
        rows = conn.execute(query, params).fetchall()
    results = []
    for r in rows:
        d = dict(r)
        try:
            d["payload_json"] = json.loads(d.get("payload_json") or "{}")
        except (json.JSONDecodeError, TypeError):
            d["payload_json"] = {}
        try:
            d["metadata_json"] = json.loads(d.get("metadata_json") or "{}")
        except (json.JSONDecodeError, TypeError):
            d["metadata_json"] = {}
        results.append(d)
    return results


def get_button_click_stats(button_id: str = None, wa_id: str = None) -> dict:
    query = "SELECT COUNT(*) as total, button_id, label FROM button_clicks WHERE 1=1"
    params = []
    if button_id:
        query += " AND button_id = ?"
        params.append(button_id)
    if wa_id:
        query += " AND wa_id = ?"
        params.append(wa_id)
    query += " GROUP BY button_id, label ORDER BY total DESC"
    with get_db_context() as conn:
        rows = conn.execute(query, params).fetchall()
    return {"total_clicks": sum(r["total"] for r in rows), "by_button": [dict(r) for r in rows]}


# ── Search helpers ───────────────────────────────────────────────────────

def search_faq_db(query: str, limit: int = 5) -> list:
    import re as _re
    words = [w for w in _re.findall(r"[a-zA-Z]{2,}", query.lower())]
    if not words:
        return []
    with get_db_context() as conn:
        rows = conn.execute(
            """SELECT * FROM faq_dataset
               WHERE content LIKE ?
               ORDER BY id DESC LIMIT ?""",
            (f"%{query}%", limit),
        ).fetchall()
        if rows:
            return [dict(r) for r in rows]
        all_rows = conn.execute("SELECT * FROM faq_dataset").fetchall()
        scored = []
        for r in all_rows:
            d = dict(r)
            searchable = " ".join([
                (d.get("source_file") or "").lower(),
                (d.get("content") or "").lower(),
            ])
            score = sum(2 for w in words if w in searchable)
            if score > 0:
                scored.append((score, d))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [d for _, d in scored[:limit]]


def search_knowledge_base_db(query: str, limit: int = 5) -> list:
    import re as _re
    words = [w for w in _re.findall(r"[a-zA-Z]{2,}", query.lower())]
    if not words:
        return []
    with get_db_context() as conn:
        rows = conn.execute(
            """SELECT * FROM knowledge_base
               WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
               ORDER BY id DESC LIMIT ?""",
            (f"%{query}%", f"%{query}%", f"%{query}%", limit),
        ).fetchall()
        if rows:
            return [dict(r) for r in rows]
        all_rows = conn.execute("SELECT * FROM knowledge_base").fetchall()
        scored = []
        for r in all_rows:
            d = dict(r)
            searchable = " ".join([
                (d.get("title") or "").lower(),
                (d.get("content") or "").lower(),
                (d.get("tags") or "").lower(),
            ])
            score = sum(2 for w in words if w in searchable)
            if score > 0:
                scored.append((score, d))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [d for _, d in scored[:limit]]


# ── Admin account helpers ────────────────────────────────────────────────

def count_admins() -> int:
    with get_db_context() as conn:
        row = conn.execute("SELECT COUNT(*) as c FROM admins").fetchone()
    return row["c"] if row else 0


def create_admin(username: str, password_hash: str, salt: str = "", role: str = "sub_admin",
                 permissions: dict = None, recovery_key: str = None) -> int:
    with get_db_context() as conn:
        cur = conn.execute(
            """INSERT INTO admins (username, password_hash, salt, role, permissions, recovery_key)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (username, password_hash, salt, role,
             json.dumps(permissions or {}), recovery_key),
        )
        return cur.lastrowid


def get_admin_by_username(username: str) -> dict:
    with get_db_context() as conn:
        row = conn.execute("SELECT * FROM admins WHERE username = ?", (username,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["permissions"] = _loads_json(d.get("permissions"), {})
    return d


def get_admin_by_id(admin_id: int) -> dict:
    with get_db_context() as conn:
        row = conn.execute("SELECT * FROM admins WHERE id = ?", (admin_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["permissions"] = _loads_json(d.get("permissions"), {})
    return d


def list_admins() -> list:
    with get_db_context() as conn:
        rows = conn.execute("SELECT * FROM admins ORDER BY created_at ASC").fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["permissions"] = _loads_json(d.get("permissions"), {})
        result.append(d)
    return result


def update_admin(username: str, **kwargs) -> bool:
    allowed = {"password_hash", "salt", "role", "permissions", "recovery_key"}
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if not updates:
        return False
    if "permissions" in updates and isinstance(updates["permissions"], dict):
        updates["permissions"] = json.dumps(updates["permissions"])
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [username]
    with get_db_context() as conn:
        conn.execute(f"UPDATE admins SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE username = ?", values)
    return True


def delete_admin(username: str) -> bool:
    with get_db_context() as conn:
        conn.execute("DELETE FROM admins WHERE username = ?", (username,))
    return True


def count_admins_by_role(role: str) -> int:
    with get_db_context() as conn:
        row = conn.execute("SELECT COUNT(*) as cnt FROM admins WHERE role = ?", (role,)).fetchone()
    return row["cnt"] if row else 0


def get_admin_record(username: str) -> dict:
    with get_db_context() as conn:
        row = conn.execute("SELECT * FROM admins WHERE username = ?", (username,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["permissions"] = _loads_json(d.get("permissions"), {})
    return d


def list_admin_records(tenant_id: int = None) -> list:
    # tenant_id filters the listing so one company never sees another's admins.
    # None keeps the legacy behaviour (all admins), used by super-admin tools.
    with get_db_context() as conn:
        if tenant_id is not None:
            rows = conn.execute(
                "SELECT * FROM admins WHERE tenant_id = ? ORDER BY created_at ASC",
                (tenant_id,),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM admins ORDER BY created_at ASC").fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["permissions"] = _loads_json(d.get("permissions"), {})
        result.append(d)
    return result


def update_admin_record(username: str, role: str = None, permissions: dict = None) -> bool:
    updates = {}
    if role is not None:
        updates["role"] = role
    if permissions is not None:
        updates["permissions"] = json.dumps(permissions)
    if not updates:
        return False
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [username]
    with get_db_context() as conn:
        conn.execute(f"UPDATE admins SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE username = ?", values)
    return True


def update_admin_email(username: str, email: str = None) -> bool:
    with get_db_context() as conn:
        conn.execute("UPDATE admins SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?", (email, username))
    return True


def set_admin_otp(username: str, otp_code: str, expires_at: str) -> bool:
    with get_db_context() as conn:
        conn.execute(
            "INSERT INTO admin_otps (username, otp_code, expires_at) VALUES (?, ?, ?)",
            (username, otp_code, expires_at),
        )
    return True


def get_admin_otp(username: str) -> dict:
    with get_db_context() as conn:
        row = conn.execute(
            "SELECT * FROM admin_otps WHERE username = ? ORDER BY id DESC LIMIT 1",
            (username,),
        ).fetchone()
    return dict(row) if row else None


def clear_admin_otp(username: str) -> bool:
    with get_db_context() as conn:
        conn.execute("DELETE FROM admin_otps WHERE username = ?", (username,))
    return True


# ── Admin uploaded file registry ─────────────────────────────────────────

def save_admin_file(name: str, ext: str, module: str, size: int,
                    doc_id: int = None, file_path: str = None, url: str = None) -> int:
    with get_db_context() as conn:
        cur = conn.execute(
            """INSERT INTO admin_files (name, ext, module, size, doc_id, file_path, url)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (name, ext, module, size, doc_id, file_path, url),
        )
        return cur.lastrowid


def list_admin_files() -> list:
    with get_db_context() as conn:
        rows = conn.execute(
            "SELECT * FROM admin_files ORDER BY created_at DESC, id DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_admin_file(name: str) -> dict:
    with get_db_context() as conn:
        row = conn.execute(
            "SELECT * FROM admin_files WHERE name = ? ORDER BY id DESC LIMIT 1",
            (name,),
        ).fetchone()
    return dict(row) if row else None


def delete_admin_file(name: str) -> bool:
    with get_db_context() as conn:
        conn.execute("DELETE FROM admin_files WHERE name = ?", (name,))
    return True


# ── Admin-to-admin chat helpers ──────────────────────────────────────────

def save_admin_chat_message(chat_id: str, username: str, message: str,
                            attachment: dict = None) -> dict:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db_context() as conn:
        cur = conn.execute(
            """INSERT INTO admin_chat_messages (chat_id, sender, username, text, message, attachment_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (chat_id, username, username, message, message,
             json.dumps(attachment) if attachment else None, now),
        )
        return {"id": cur.lastrowid, "chat_id": chat_id, "username": username,
                "message": message, "text": message, "created_at": now,
                "attachment": attachment}


def get_admin_chat_history(chat_id: str, username: str = None, limit: int = 200) -> list:
    cutoff = (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d %H:%M:%S")
    with get_db_context() as conn:
        if username:
            rows = conn.execute(
                """SELECT id, chat_id, COALESCE(sender, username) as username,
                          COALESCE(text, message) as message, created_at, attachment_json
                   FROM admin_chat_messages
                   WHERE chat_id = ? AND created_at >= ?
                     AND id NOT IN (
                       SELECT message_id FROM deleted_chat_messages WHERE username = ?
                     )
                   ORDER BY id DESC LIMIT ?""",
                (chat_id, cutoff, username, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT id, chat_id, COALESCE(sender, username) as username,
                          COALESCE(text, message) as message, created_at, attachment_json
                   FROM admin_chat_messages
                   WHERE chat_id = ? AND created_at >= ?
                   ORDER BY id DESC LIMIT ?""",
                (chat_id, cutoff, limit),
            ).fetchall()
        result = []
        for r in reversed(rows):
            item = dict(r)
            if item.get("attachment_json"):
                try:
                    item["attachment"] = json.loads(item["attachment_json"])
                except Exception:
                    item["attachment"] = None
            else:
                item["attachment"] = None
            result.append(item)
        return result


def get_admin_chat_preview(username: str) -> list:
    with get_db_context() as conn:
        rows = conn.execute(
            """SELECT acm.chat_id, COALESCE(acm.text, acm.message) as message,
                      COALESCE(acm.sender, acm.username) as username, acm.created_at
               FROM admin_chat_messages acm
               INNER JOIN (
                   SELECT chat_id, MAX(id) as max_id FROM admin_chat_messages
                   WHERE chat_id LIKE ? OR chat_id LIKE ?
                   GROUP BY chat_id
               ) latest ON acm.id = latest.max_id
               ORDER BY acm.created_at DESC""",
            (f"%|{username}", f"{username}|%"),
        ).fetchall()
        return [dict(r) for r in rows]


def _chat_message_to_dict(row) -> dict:
    d = dict(row)
    raw_att = d.pop("attachment_json", None)
    d["attachment"] = _loads_json(raw_att, None) if raw_att else None
    d["username"] = d.get("sender") or d.get("username", "")
    return d


def get_chat_history(chat_id: str, limit: int = 200) -> list:
    with get_db_context() as conn:
        rows = conn.execute(
            """SELECT * FROM admin_chat_messages
               WHERE chat_id = ?
               ORDER BY id ASC LIMIT ?""",
            (chat_id, limit),
        ).fetchall()
    return [_chat_message_to_dict(r) for r in rows]


def get_chat_last_message(chat_id: str) -> dict:
    with get_db_context() as conn:
        row = conn.execute(
            """SELECT * FROM admin_chat_messages
               WHERE chat_id = ?
               ORDER BY id DESC LIMIT 1""",
            (chat_id,),
        ).fetchone()
    return _chat_message_to_dict(row) if row else None


def save_chat_message(chat_id: str, sender: str, text: str,
                      attachment: dict = None) -> int:
    with get_db_context() as conn:
        cur = conn.execute(
            """INSERT INTO admin_chat_messages (chat_id, sender, text, attachment_json)
               VALUES (?, ?, ?, ?)""",
            (chat_id, sender, text or "", json.dumps(attachment) if attachment else None),
        )
        return cur.lastrowid


def delete_chat_message(message_id: int) -> bool:
    with get_db_context() as conn:
        conn.execute("DELETE FROM admin_chat_messages WHERE id = ?", (message_id,))
    return True


def mark_chat_message_deleted(message_id: int, username: str) -> bool:
    with get_db_context() as conn:
        conn.execute(
            "UPDATE admin_chat_messages SET deleted_for = ? WHERE id = ?",
            (username, message_id),
        )
    return True


def delete_admin_chat_message(msg_id: int) -> bool:
    with get_db_context() as conn:
        result = conn.execute("DELETE FROM admin_chat_messages WHERE id = ?", (msg_id,))
        return result.rowcount > 0


def soft_delete_message_for_user(msg_id: int, username: str):
    with get_db_context() as conn:
        row = conn.execute("SELECT message FROM admin_chat_messages WHERE id = ?", (msg_id,)).fetchone()
        message = row["message"] if row else None
        conn.execute(
            "INSERT OR IGNORE INTO deleted_chat_messages (message_id, username, message) VALUES (?, ?, ?)",
            (msg_id, username, message),
        )


def soft_delete_message_for_everyone(msg_id: int):
    with get_db_context() as conn:
        row = conn.execute("SELECT message FROM admin_chat_messages WHERE id = ?", (msg_id,)).fetchone()
        message = row["message"] if row else None
        admins = conn.execute("SELECT username FROM admins").fetchall()
        for admin in admins:
            conn.execute(
                "INSERT OR IGNORE INTO deleted_chat_messages (message_id, username, message) VALUES (?, ?, ?)",
                (msg_id, admin["username"], message),
            )


def get_all_admins_except(current_username: str) -> list:
    with get_db_context() as conn:
        rows = conn.execute(
            "SELECT username FROM admins WHERE username != ? ORDER BY username",
            (current_username,),
        ).fetchall()
        return [r["username"] for r in rows]
