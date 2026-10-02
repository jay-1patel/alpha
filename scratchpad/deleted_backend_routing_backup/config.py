import os
import re
import logging
from pathlib import Path
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ROUTING_DIR = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / "backend"
BASE_DIR = BACKEND_DIR

load_dotenv(ROUTING_DIR / ".env")


def _int_env(name: str, default: int) -> int:
    """Read an int from the environment, tolerating blank/missing values.

    os.getenv's default only kicks in when the key is ABSENT. A .env line like
    `SMTP_PORT = ` sets it to an empty string, so int() would raise ValueError
    and take down the whole app at import time.
    """
    raw = os.getenv(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return int(str(raw).strip())
    except ValueError:
        logging.getLogger(__name__).warning(
            "%s=%r is not an integer; using %s", name, raw, default
        )
        return default

# ── WhatsApp / send2.digital ──────────────────────────────────────────────
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN")
SEND2_USERNAME = os.getenv("SEND2_USERNAME")
SEND2_PASSWORD = os.getenv("SEND2_PASSWORD")
SEND2_NUMBER = os.getenv("SEND2_NUMBER")
SEND2_SESSION_MSG_URL = os.getenv("SEND2_SESSION_MSG_URL")
SEND2_INCOMING_URL = os.getenv("SEND2_INCOMING_URL")
SEND2_LIST_MENU_URL = os.getenv("SEND2_LIST_MENU_URL")
SEND2_QUICK_BUTTON_URL = os.getenv("SEND2_QUICK_BUTTON_URL")
SEND2_MEDIA_URL = os.getenv("SEND2_MEDIA_URL")
SEND2_TEMPLATE_URL=os.getenv("SEND2_TEMPLATE_URL")
SEND2_SESSION_SEND_URL = os.getenv(
    "SEND2_SESSION_SEND_URL",
    "https://api.send2.digital/devdesk/session-msg-send",
)
# ── Database ──────────────────────────────────────────────────────────────
# Kept in sync with routing/config.py: repo-root faq.db, overridable via
# ROUTING_DB_PATH. Never hardcode an absolute path — SQLite creates a missing
# file, so a stale path silently produces an empty DB ("no such table").
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DB_PATH = os.getenv("ROUTING_DB_PATH") or str(_REPO_ROOT / "faq.db")
if not os.path.isabs(DB_PATH):
    DB_PATH = str((_REPO_ROOT / DB_PATH).resolve())
DB_PATH = os.path.normpath(DB_PATH)

# ── Embedding model ───────────────────────────────────────────────────────
_local_model_path = BACKEND_DIR / "models" / "bge-m3"
EMBEDDING_MODEL_PATH = str(_local_model_path) if _local_model_path.is_dir() else "BAAI/bge-m3"

# ── Server ports ──────────────────────────────────────────────────────────
ROUTER_PORT = _int_env("ROUTER_PORT", 9000)

# ── LLM ───────────────────────────────────────────────────────────────────
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL")

GROQ_API_URL = os.getenv("GROQ_API_URL")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL")

MISTRAL_API_URL = os.getenv("MISTRAL_API_URL")
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY","MISTRAL_API_BACKUP")
MISTRAL_MODEL = os.getenv("MISTRAL_MODEL")

# ── Bot messaging defaults ────────────────────────────────────────────────
BUSINESS_NAME = os.getenv("BRAND_NAME")
BOT_NAME = os.getenv("BOT_NAME", BUSINESS_NAME)
WELCOME_MESSAGE = os.getenv("WELCOME_MESSAGE", f"Welcome to {BUSINESS_NAME}! How can I help you today?")
MENU_HEADER = os.getenv("MENU_HEADER", BUSINESS_NAME)
MENU_BODY = os.getenv("MENU_BODY", "What would you like help with?")
MENU_FOOTER = os.getenv("MENU_FOOTER", "Or type your question directly")
TEMPLATE_PREFIX = os.getenv("TEMPLATE_PREFIX", BUSINESS_NAME.replace(" ", "_"))
IMAGE_BASE_URL = os.getenv("IMAGE_BASE_URL")

# ── Auth / admin ──────────────────────────────────────────────────────────
ADMIN_SECRET_KEY = os.getenv("ADMIN_SECRET_KEY")
ADMIN_JWT_SECRET = os.getenv("ADMIN_JWT_SECRET")
ADMIN_JWT_EXPIRY_HOURS = _int_env("ADMIN_JWT_EXPIRY_HOURS", 24)
ADMIN_TOKEN_TTL_HOURS = _int_env("ADMIN_TOKEN_TTL_HOURS", 168)
ADMIN_RECOVERY_KEY = os.getenv("ADMIN_RECOVERY_KEY")
OTP_EXPIRY_MINUTES = _int_env("OTP_EXPIRY_MINUTES", 10)

# ── Storage / uploads ─────────────────────────────────────────────────────
UPLOAD_DIR = str(BACKEND_DIR / "uploaded_files")
IMGHIPPO_API_KEY = os.getenv("IMGHIPPO_API_KEY", "")

# ── Brand / support ───────────────────────────────────────────────────────
BRAND_NAME = os.getenv("BRAND_NAME")
BRAND_TAGLINE = os.getenv("BRAND_TAGLINE")
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL")
SUPPORT_PHONE = os.getenv("SUPPORT_PHONE")
BRAND_WEBSITE = os.getenv("BRAND_WEBSITE")
SIGNATURE = os.getenv("SIGNATURE")

# ── Routing-specific ──────────────────────────────────────────────────────
SEND_MEDIA = os.getenv("SEND_MEDIA", "false").lower() == "true"

# ── Feature flags ──────────────────────────────────────────────────────────
# Canonical DB-backed cart layer. When false, Path A/B fall back to the
# in-memory/context cart behaviour already in bots/customer_b2c/cart.py.
CART_ENABLED = os.getenv("CART_ENABLED", "true").lower() == "true"
CART_TTL_DAYS = _int_env("CART_TTL_DAYS", 7)

# ── Tunnel / public URL ───────────────────────────────────────────────────
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL").rstrip("/")
HKDEK_WEBHOOK_URL = os.getenv("HKDEK_WEBHOOK_URL")

# ── Logging ───────────────────────────────────────────────────────────────
logger = logging.getLogger(f"{BOT_NAME}_bot")


def detect_tunnel_url() -> str:
    """Auto-detect Cloudflare tunnel URL from log files."""
    log_patterns = ["*_cf_err*.log", "*_cf_out*.log", "*cloudflared*.log", "*cf*.log"]
    tunnel_pattern = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")

    for pattern in log_patterns:
        for log_file in BACKEND_DIR.glob(pattern):
            try:
                content = log_file.read_text(encoding="utf8", errors="ignore")
                matches = tunnel_pattern.findall(content)
                if matches:
                    latest = matches[-1]
                    if latest != PUBLIC_BASE_URL:
                        logger.warning(f"Tunnel URL mismatch: .env has {PUBLIC_BASE_URL}, log has {latest}")
                    return latest
            except Exception as e:
                logger.debug(f"Could not read {log_file}: {e}")
    return ""
