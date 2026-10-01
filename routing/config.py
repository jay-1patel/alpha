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
DB_PATH = os.getenv("ROUTING_DB_PATH", r"C:\keya\2608\FAQ.DB")

# ── Embedding model ───────────────────────────────────────────────────────
_local_model_path = BACKEND_DIR / "models" / "bge-m3"
EMBEDDING_MODEL_PATH = str(_local_model_path) if _local_model_path.is_dir() else "BAAI/bge-m3"

# ── Server ports ──────────────────────────────────────────────────────────
ROUTER_PORT = int(os.getenv("ROUTER_PORT", "9000"))

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

# STRICT_LOCAL_LLM=1 -> only Ollama is allowed; Groq/Mistral cloud fallbacks are disabled
STRICT_LOCAL_LLM = os.getenv("STRICT_LOCAL_LLM", "0").lower() in ("1", "true", "yes")

# ── Website ingestion (Leeway Softech knowledge scraping) ─────────────────
WEBSITE_CRAWL_URL = os.getenv("WEBSITE_CRAWL_URL", "https://www.leewaysoftech.com")
WEBSITE_CRAWL_MAX_PAGES = int(os.getenv("WEBSITE_CRAWL_MAX_PAGES", "150"))
WEBSITE_CRAWL_DELAY = float(os.getenv("WEBSITE_CRAWL_DELAY", "0.5"))

# ── Bot messaging defaults ────────────────────────────────────────────────
# Branding is env-driven here (bootstrap-time); the DB-backed branding
# config (published_config scope "branding") overrides it at runtime.
BUSINESS_NAME = os.getenv("BRAND_NAME") or "Business"
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
ADMIN_JWT_EXPIRY_HOURS = int(os.getenv("ADMIN_JWT_EXPIRY_HOURS"))
ADMIN_TOKEN_TTL_HOURS = int(os.getenv("ADMIN_TOKEN_TTL_HOURS"))
ADMIN_RECOVERY_KEY = os.getenv("ADMIN_RECOVERY_KEY")
OTP_EXPIRY_MINUTES = int(os.getenv("OTP_EXPIRY_MINUTES"))

# ── Storage / uploads ─────────────────────────────────────────────────────
UPLOAD_DIR = str(BACKEND_DIR / "uploaded_files")
IMGHIPPO_API_KEY = os.getenv("IMGHIPPO_API_KEY", "")

# ── Email / SMTP (for OTP delivery) ──────────────────────────────────────
# SECURITY FIX: All SMTP credentials loaded from environment variables
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "")

# ── Brand / support ───────────────────────────────────────────────────────
BRAND_NAME = os.getenv("BRAND_NAME")
BRAND_TAGLINE = os.getenv("BRAND_TAGLINE")
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL")
SUPPORT_PHONE = os.getenv("SUPPORT_PHONE")
BRAND_WEBSITE = os.getenv("BRAND_WEBSITE")
SIGNATURE = os.getenv("SIGNATURE")

# ── Routing-specific ──────────────────────────────────────────────────────
SEND_MEDIA = os.getenv("SEND_MEDIA", "false").lower() == "true"
CATALOG_DELIVERY_MODE = os.getenv("CATALOG_DELIVERY_MODE", "pdf").lower().strip()

CATALOGUE_PDF_URL = os.getenv("CATALOGUE_PDF_URL", "https://files.catbox.moe/h2pw4m.pdf")
CATALOGUE_PDF_FILENAME = os.getenv("CATALOGUE_PDF_FILENAME", "Leeway Softtech Product Catalogue.pdf")

CATALOGUE_BUTTON_ID = os.getenv("CATALOGUE_BUTTON_ID", "new_arrival")
CATALOGUE_BUTTON_TITLE = os.getenv("CATALOGUE_BUTTON_TITLE", "New Arrivals")
CATALOGUE_BODY_TEXT = os.getenv("CATALOGUE_BODY_TEXT", "Choose an option:")

# ── Tunnel / public URL ───────────────────────────────────────────────────
PUBLIC_BASE_URL = (os.getenv("PUBLIC_BASE_URL") or "http://localhost:9000").rstrip("/")
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
