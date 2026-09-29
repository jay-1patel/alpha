import logging
import re

from routing.classifier import classify_query, generate_greeting
from routing.config import SEND_MEDIA, BUSINESS_NAME

logger = logging.getLogger("message")


def _get_greeting_menu(wa_id: str):
    """Lazy import to avoid circular imports in standalone KB mode."""
    from services.menu_service import get_greeting_menu
    return get_greeting_menu(wa_id)


BUTTON_INTENTS = [
    {
        "name": "moq",
        "keywords": (
            "moq", "minimum order quantity", "minimum order", "minimum quantity",
            "min order", "min quantity", "min qty", "minimum qty", "order quantity",
        ),
        "buttons": [{"type": "reply", "reply": {"id": "check_moq", "title": "Check MOQ by product"}}],
    },
    {
        "name": "bulk_discount",
        "keywords": (
            "bulk discount", "quantity discount", "volume discount", "wholesale discount",
            "wholesale price", "bulk pricing", "discount on bulk", "discounts on bulk",
            "large order discount", "discount for large order",
        ),
        "buttons": [{"type": "reply", "reply": {"id": "view_discounts", "title": "View qty discounts"}}],
    },
    {
        "name": "credit",
        "keywords": (
            "credit period", "credit terms", "credit line", "credit facility",
            "credit eligibility", "buy now pay later", "net 30", "net 45", "net 60",
        ),
        "buttons": [{"type": "reply", "reply": {"id": "check_credit", "title": "Credit eligibility"}}],
    },
    {
        "name": "payment",
        "keywords": (
            "payment method", "payment methods", "payment option", "payment options",
            "payment terms", "how can i pay", "how to pay", "how do i pay", "ways to pay",
            "mode of payment", "make payment", "payment",
        ),
        "buttons": [{"type": "reply", "reply": {"id": "view_payment", "title": "View payment methods"}}],
    },
]

DOCUMENT_BUTTON_ID = "send_document"
DOCUMENT_BUTTON_TITLE = "View Document"

_DOCUMENT_MEDIA_TYPES = frozenset(
    {"pdf", "doc", "docx", "xlsx", "xls", "csv", "document"}
)


def _media_is_document(media_type: str) -> bool:
    """True only when the attached media is a document (not an image/video)."""
    return (media_type or "").lower().strip() in _DOCUMENT_MEDIA_TYPES

DIRECT_MEDIA_KEYWORDS = (
    "catalogue", "catalog", "brochure", "product list", "price list", "product lineup",
    "product range", "menu", "new arrival", "new arrivals", "new launch", "new launches",
    "new product", "latest product", "latest launch", "fresh drops", "recent additions",
)

NO_FALLBACK_KB_QUERIES = {
    "about company", "about leeway softtech", "about us", "company info",
    "who is the founder", "when was leeway softtech founded", "leeway softtech story",
    "tell me about leeway softtech", "what is leeway softtech",
}


# Question words/phrases indicate the user is asking about the *contents* of
# the document (what's inside, prices, products, specs, etc.) — those should
# get a text answer from the FAQ bot, not the raw PDF.
CONTENT_QUESTION_MARKERS = (
    "tell me", "is there", "are there", "detail", "details",
    "ingredient", "contain", "contains", "included", "inside",
    "spec", "nutrition", "flavour", "flavor",
)


def is_direct_media_query(text) -> bool:
    lower = (text or "").lower()
    # Word-boundary match for question words so "show" is not caught by "how".
    if re.search(r"\b(what|which|how|why|when|who)\b", lower):
        return False
    if any(m in lower for m in CONTENT_QUESTION_MARKERS):
        return False
    return any(kw in lower for kw in DIRECT_MEDIA_KEYWORDS)


def build_catalog_summary(user_text: str) -> dict | None:
    """Option A: build a product summary + Download PDF button for direct
    catalogue/new-arrival queries, instead of dumping the raw PDF.

    Returns {"text": str, "buttons": [...]} or None when no structured
    products exist (caller then falls back to the legacy direct-PDF send).
    """
    lower = (user_text or "").lower()
    wants_arrivals = "arrival" in lower or "launch" in lower or "latest" in lower or "new product" in lower
    try:
        from backend.database import list_products
        if wants_arrivals:
            products = list_products(category="new_arrival", limit=8)
        else:
            products = list_products(category="catalogue", limit=8)
            if not products:
                products = list_products(limit=8)
    except Exception as e:
        logger.warning(f"catalog summary product lookup failed: {e}")
        return None

    if not products:
        return None

    lines = ["✨ Here's what we have for you:"]
    for i, p in enumerate(products[:8], start=1):
        price = f" — ₹{p['price']}" if p.get("price") else ""
        desc = (p.get("short_description") or p.get("description") or "")[:60]
        lines.append(f"{i}. {p['name']}{price}")
        if desc:
            lines.append(f"   {desc}")
    lines.append("\nTap below to view the full document or explore more.")

    buttons = [
        {"type": "reply", "reply": {"id": "menu_products", "title": "Browse Products"}},
        {"type": "reply", "reply": {"id": DOCUMENT_BUTTON_ID, "title": "Download Full PDF"}},
    ]
    return {"text": "\n".join(lines), "buttons": buttons}


def _is_distributor(wa_id) -> bool:
    """Return True if wa_id is a registered B2B distributor."""
    if not wa_id:
        return False
    try:
        from backend.database import get_db_context
        with get_db_context() as conn:
            row = conn.execute(
                "SELECT 1 FROM distributors WHERE wa_id = ?", (str(wa_id),)
            ).fetchone()
            return row is not None
    except Exception as e:
        logger.warning(f"distributor check failed for {wa_id}: {e}")
        return False


async def _handle_b2b_message(user_text: str, wa_id: str) -> dict:
    """Route a recognized distributor through the B2B orchestrator.

    The B2B flow sends its own replies (via the shared WhatsApp sender), so we
    signal ``whatsapp_sent=True`` and return no text so the webhook does not
    double-send.
    """
    try:
        from backend.services.orchestrator import process_incoming_message
        result = await process_incoming_message(wa_id, user_text)
        status = result.get("status", "processed")
        logger.info(f"B2B_ROUTE | wa_id={wa_id} | status={status} | msg='{user_text[:80]}'")
        return {
            "answer": "",
            "media_url": None,
            "media_type": None,
            "whatsapp_sent": True,
            "interactive": None,
            "query_type": "b2b_distributor",
        }
    except Exception as e:
        logger.error(f"B2B_ROUTE_FAILED | wa_id={wa_id} | error={e}")
        # Fall back to the normal FAQ/KB handling below.
        return None


def _is_button_reply(raw_message) -> bool:
    if not isinstance(raw_message, dict):
        return False
    return (
        raw_message.get("type") == "interactive"
        and raw_message.get("interactive", {}).get("type") in ("button_reply", "list_reply")
    )


def get_buttons_for_query(text) -> list | None:
    lower = (text or "").lower()
    for intent in BUTTON_INTENTS:
        if any(kw in lower for kw in intent["keywords"]):
            return intent["buttons"]
    return None


UNCERTAIN_PHRASES = [
    "i don't know", "i dont know", "i do not know", "don't know", "dont know", "do not know",
    "i'm not sure", "i am not sure", "im not sure", "not sure", "not certain", "not confident",
    "i don't have information", "i do not have information", "don't have information",
    "do not have information", "not have any information", "no information",
    "not enough information", "don't have enough information", "do not have enough information",
    "i don't have enough", "i do not have enough",
    "can't answer", "cannot answer", "can not answer", "unable to answer", "not able to answer",
    "unable to find", "couldn't find", "could not find", "no answer found",
    "not able to help", "beyond my knowledge", "no relevant information",
    "nothing in the context", "not in the context",
]


def is_uncertain_answer(answer: str) -> bool:
    if not answer:
        return False
    lower = answer.lower()
    return any(phrase in lower for phrase in UNCERTAIN_PHRASES)


def get_greeting_response(text: str) -> str:
    return generate_greeting(text)


async def forward_to_bot(query_type, user_text, wa_id=None, raw_message=None):
    if query_type == "faq":
        from backend.faq.service import handle_faq_query
        data = await handle_faq_query({"message": user_text})
    else:
        from kb.service import handle_kb_query
        data = await handle_kb_query(
            wa_id=wa_id or "",
            message=user_text,
            sender_name="",
            update_session=True,
            raw_message=raw_message,
        )
    logger.info(f"{query_type} bot response keys: {list(data.keys())}, media_url={data.get('media_url')}, media_type={data.get('media_type')}, whatsapp_sent={data.get('whatsapp_sent')}")
    return data


async def process_message(user_text: str, wa_id: str = None, raw_message: dict = None):
    is_btn_reply = _is_button_reply(raw_message)

    # Interactive replies from our own menus (product/category list rows, cart /
    # checkout buttons, dynamic Ollama buttons) must reach the KB handler, which
    # routes by the button/list id. Never let the classifier turn these into a
    # greeting — e.g. selecting "til chikki" from the catalog was being
    # classified as "greeting" by Ollama, dumping the user to the main menu.
    if is_btn_reply:
        query_type = "kb"
        logger.info(f"Button/list reply detected; routing to KB by id")
    else:
        query_type = classify_query(user_text)
        logger.info(f"Query classified as: {query_type}")

    result = {"answer": "", "media_url": None, "media_type": None, "whatsapp_sent": False, "interactive": None, "query_type": query_type}

    # ── B2B DISTRIBUTOR PRE-ROUTE ─────────────────────────────────────────
    # Recognized distributors go through the dedicated B2B flow (place order,
    # catalogue, price list, schemes, outstanding, tickets, etc.). The B2B flow
    # sends its own replies, so when it handles the message we stop here.
    if wa_id and _is_distributor(wa_id):
        b2b = await _handle_b2b_message(user_text, wa_id)
        if b2b is not None:
            return b2b

    # ── KB CHECKOUT STATE BYPASS ────────────────────────────────────────────
    # While a user is in the KB checkout data-collection flow (name/mobile/
    # pincode/address/payment/final-confirm), bypass query classification so
    # the typed details are not misrouted to the FAQ bot (address/location/
    # payment keywords would match) and break the checkout sequence.
    try:
        from kb.services.menu_router import get_current_state as _kb_state
        from kb.services.menu_router import UserState as _KBUserState
        _checkout_states = (
            _KBUserState.AWAITING_CHECKOUT_CONFIRM,
            _KBUserState.CHECKOUT_NAME,
            _KBUserState.CHECKOUT_MOBILE,
            _KBUserState.CHECKOUT_PINCODE,
            _KBUserState.CHECKOUT_ADDRESS,
            _KBUserState.CHECKOUT_PAYMENT,
            _KBUserState.CHECKOUT_FINAL_CONFIRM,
        )
        _in_checkout = bool(wa_id) and _kb_state(wa_id) in _checkout_states
    except Exception:
        _in_checkout = False

    if _in_checkout:
        data = await forward_to_bot("kb", user_text, wa_id, raw_message)
        result["query_type"] = "kb"
        result["answer"] = data.get("answer", "")
        result["media_url"] = data.get("media_url")
        result["media_type"] = data.get("media_type")
        result["whatsapp_sent"] = bool(data.get("whatsapp_sent"))
        result["interactive"] = data.get("interactive")
        return result

    if query_type == "greeting":
        # Show the main menu directly; no LLM greeting text is needed.
        result["answer"] = ""
        result["interactive"] = _get_greeting_menu(wa_id)
        return result

    data = await forward_to_bot(query_type, user_text, wa_id, raw_message)

    skip_fallback = is_btn_reply or (
        query_type == "kb" and any(kw in user_text.lower() for kw in NO_FALLBACK_KB_QUERIES)
    )

    if not skip_fallback and (not data.get("answer") or is_uncertain_answer(data.get("answer"))):
        fallback_type = "kb" if query_type == "faq" else "faq"
        logger.info(f"Falling back to {fallback_type} bot: primary returned empty/uncertain answer")
        data = await forward_to_bot(fallback_type, user_text, wa_id, raw_message)

    answer = data.get("answer", "")
    if not answer or is_uncertain_answer(answer):
        answer = (
            "Hmm, I couldn't find a solid answer for that one 🤔 "
            "Try rephrasing, or tap below and our team will jump in to help! 🙋"
        )
        data = {}

    result["answer"] = answer
    result["media_url"] = data.get("media_url")
    result["media_type"] = data.get("media_type")
    result["whatsapp_sent"] = bool(data.get("whatsapp_sent"))
    result["interactive"] = data.get("interactive")

    if not is_btn_reply:
        existing = result["interactive"]
        if existing and existing.get("type") == "button":
            buttons = list(existing.get("buttons") or [])
        elif existing is None:
            buttons = list(get_buttons_for_query(user_text) or [])
        else:
            buttons = None

        if buttons is not None:
            if (
                SEND_MEDIA
                and result["media_url"]
                and result["media_type"]
                and not is_direct_media_query(user_text)
                and _media_is_document(result["media_type"])
            ):
                buttons.append({
                    "type": "reply",
                    "reply": {"id": DOCUMENT_BUTTON_ID, "title": DOCUMENT_BUTTON_TITLE},
                })
            # WhatsApp allows max 3 buttons; always keep "View Document" (last).
            if len(buttons) > 3:
                buttons = buttons[:2] + buttons[-1:]
            result["interactive"] = {"type": "button", "buttons": buttons}

    return result
