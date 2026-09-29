import json
import logging
import time
from fastapi import APIRouter, Request, HTTPException, Query, BackgroundTasks
from fastapi.responses import PlainTextResponse
from fastapi.exceptions import RequestValidationError
import routing.config as config
from routing.database import log_webhook, save_chat
from routing.whatsapp import send_whatsapp_message, send_whatsapp_interactive, send_whatsapp_list_menu, _resolve_media_url, _normalize_msg_type
from routing.message import process_message, DOCUMENT_BUTTON_ID, is_direct_media_query, build_catalog_summary
from routing.classifier import classify_query
from routing.button_actions import get_action, BUTTON_REGISTRY
from routing import complaint_flow
from backend.integrations.company_api import log_incoming_message, log_outgoing_message

logger = logging.getLogger("leeway_webhook")

# SECURITY FIX: Input validation constants
MAX_WEBHOOK_PAYLOAD_SIZE = 100000  # 100KB max payload size
MAX_STRING_LENGTH = 10000  # 10KB max per string field
MAX_ARRAY_ITEMS = 10  # Max items in arrays
MAX_NESTING_DEPTH = 5  # Max JSON nesting depth
router = APIRouter()

# Media types the bot may send. Images are removed: any media whose normalized
# type is not document/video/audio is treated as "no media" and the bot sends
# its text answer instead.
BOT_MEDIA_TYPES = ("document", "video", "audio")


def _bot_media_type(media_type: str) -> str:
    """Return the sendable media type for the bot, or "" for removed types."""
    mt = _normalize_msg_type(media_type or "")
    return mt if mt in BOT_MEDIA_TYPES else ""


_processed_ids = set()

# Phrases that trigger human handover
HUMAN_HANDOVER_PHRASES = [
    "human", "agent", "real person", "talk to a human", "speak to a human",
    "customer support", "representative", "talk to agent", "speak to agent",
    "connect me", "connect to", "talk to someone", "speak to someone",
    "real human", "live person", "live agent", "真人",
]

HANDOVER_CONFIRMATION = "You're now connected to a human agent. Please hold on while we pick up your conversation. 🙏\n\nType *hi* anytime to continue with the chatbot."

HANDOVER_BOT_RESUME = "You're back with the bot. How can I help you? 🙏"

_PENDING_DOC_EXPIRY_SECONDS = 30 * 60
_pending_docs = {}


def _validate_payload_size(content_length: int, body_length: int) -> None:
    """Validate payload size to prevent DoS attacks.
    
    SECURITY FIX: Check content length before processing to prevent resource exhaustion.
    """
    max_size = MAX_WEBHOOK_PAYLOAD_SIZE
    if content_length > max_size or body_length > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"Payload too large. Max {max_size // 1024}KB allowed."
        )


def _sanitize_payload(payload: dict) -> dict:
    """Sanitize and limit payload fields to prevent resource exhaustion.
    
    SECURITY FIX: Limit string lengths and array sizes in payloads.
    """
    if not isinstance(payload, dict):
        return payload
    
    def _truncate_string(value, max_len=MAX_STRING_LENGTH):
        if isinstance(value, str) and len(value) > max_len:
            return value[:max_len]
        return value
    
    def _limit_array(value, max_items=MAX_ARRAY_ITEMS):
        if isinstance(value, (list, tuple)) and len(value) > max_items:
            return value[:max_items]
        return value
    
    def _sanitize_recursive(obj, depth=0):
        if depth > MAX_NESTING_DEPTH:
            return "..."
        
        if isinstance(obj, dict):
            return {_sanitize_recursive(k, depth): _sanitize_recursive(v, depth + 1) 
                    for k, v in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [_sanitize_recursive(item, depth + 1) for item in _limit_array(obj)]
        elif isinstance(obj, str):
            return _truncate_string(obj)
        else:
            return obj
    
    return _sanitize_recursive(payload)


def _is_doc_button_reply(message) -> bool:
    if not isinstance(message, dict):
        return False
    if message.get("type") != "interactive":
        return False
    interactive = message.get("interactive", {})
    if interactive.get("type") != "button_reply":
        return False
    return interactive.get("button_reply", {}).get("id") == DOCUMENT_BUTTON_ID


def _wants_human_agent(text: str) -> bool:
    """Return True if the user message requests a human agent."""
    lowered = (text or "").lower()
    return any(phrase in lowered for phrase in HUMAN_HANDOVER_PHRASES)


def _set_human_handover(wa_id: str, enabled: bool = True) -> None:
    """Set or clear the human_handover flag for a user."""
    try:
        from database import set_human_handover
        set_human_handover(wa_id, enabled)
        logger.info(f"HANDOVER {'ENABLED' if enabled else 'DISABLED'} for {wa_id}")
    except Exception as e:
        logger.error(f"Failed to set handover for {wa_id}: {e}")


def _is_handover_active(wa_id: str) -> bool:
    """Check if human_handover is currently active for a user."""
    import sqlite3
    db_path = config.DB_PATH if hasattr(config, 'DB_PATH') else None
    if not db_path:
        return False
    try:
        conn = sqlite3.connect(db_path)
        row = conn.execute(
            "SELECT human_handover FROM user_states WHERE wa_id = ?", (wa_id,)
        ).fetchone()
        conn.close()
        return row is not None and row[0] == 1
    except Exception:
        return False


def _pop_pending_doc(wa_id):
    doc = _pending_docs.pop(wa_id, None)
    if not doc:
        return None
    if time.time() - doc.get("created_at", 0) > _PENDING_DOC_EXPIRY_SECONDS:
        return None
    return doc


def _extract_button_press(message) -> tuple[str, str]:
    """Return (button_id, button_title) from an interactive button_reply, or ('', '')."""
    if not isinstance(message, dict) or message.get("type") != "interactive":
        return "", ""
    interactive = message.get("interactive", {})
    if interactive.get("type") != "button_reply":
        return "", ""
    reply = interactive.get("button_reply", {})
    return (reply.get("id", "") or "", reply.get("title", "") or "")


def _resolve_public(url: str) -> str:
    """Resolve a stored/local media URL to a public HTTPS URL."""
    if not url:
        return url
    if url.startswith(("http://", "https://")):
        return url
    try:
        from kb.services.whatsapp import resolve_public_media_url
        resolved = resolve_public_media_url(url)
        if resolved:
            return resolved
    except Exception:
        pass
    return _resolve_media_url(url)


def _find_doc_by_source(source_stem: str):
    """Find an uploaded FAQ/KB document whose filename contains the source stem."""
    import os
    if not source_stem:
        return None
    upload_root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", "uploaded_files")
    for sub in ("faq", "kb", ""):
        folder = os.path.normpath(os.path.join(upload_root, sub))
        if not os.path.isdir(folder):
            continue
        for fname in os.listdir(folder):
            stem, ext = os.path.splitext(fname)
            if source_stem.lower() in stem.lower() and ext.lower() in (".txt", ".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg"):
                return os.path.join(folder, fname)
    return None


async def _handle_registry_button(wa_id: str, sender_name: str, action: dict, start_time: float) -> bool:
    """Execute a registry button action directly. Returns True if handled."""
    kind = action.get("kind")
    payload = action.get("payload", "")

    if kind == "complaint":
        from database import get_user_state
        if get_user_state(wa_id).get("state") in complaint_flow.COMPLAINT_STATES:
            send_whatsapp_message(wa_id, "You already have a complaint form in progress. Please complete it or type *cancel* to start over.")
        else:
            complaint_flow.start_complaint(wa_id)
        save_chat(wa_id, sender_name, action["title"], "[complaint form started]", "complaint")
        logger.info(f"COMPLAINT_STARTED | {wa_id} | via button {action['id']}")
        return True

    if kind == "handover":
        _set_human_handover(wa_id, enabled=True)
        save_chat(wa_id, sender_name, action["title"], HANDOVER_CONFIRMATION, "human_handover")
        if config.SEND2_USERNAME and config.SEND2_PASSWORD:
            send_whatsapp_message(wa_id, HANDOVER_CONFIRMATION)
        logger.info(f"HANDOVER_TRIGGERED | {wa_id} | via button {action['id']}")
        return True

    if kind == "document":
        path = _find_doc_by_source(payload)
        if path and config.SEND2_USERNAME and config.SEND2_PASSWORD:
            public_url = _resolve_public(path.replace("\\", "/").split("backend/")[-1] if "/backend/" in path.replace("\\", "/") else path)
            sent = send_whatsapp_message(wa_id, public_url, "document")
            if sent:
                await log_outgoing_message(wa_id, f"[Document sent: {public_url}]", "document")
                save_chat(wa_id, sender_name, action["title"], f"[document] {public_url}", "faq")
                logger.info(f"BUTTON_DOC_SENT | {wa_id} | action={action['id']} | url={public_url[:120]}")
                return True
        # Document not found: fall through with a helpful text.
        if config.SEND2_USERNAME and config.SEND2_PASSWORD:
            send_whatsapp_message(wa_id, "Sorry, that document isn't available right now. Please ask your question again.")
        save_chat(wa_id, sender_name, action["title"], "[document unavailable]", "faq")
        return True

    if kind == "new_arrival" or action.get("id") in ("new_arrival", "menu_new_arrivals"):
        # Show new arrivals as a clean product list (no LLM/RAG pipeline —
        # routing this through the FAQ classifier produced long paragraphs).
        try:
            from database import list_products
            arrivals = list_products(category="new_arrival", limit=20)
            if arrivals:
                lines = ["✨ *New Arrivals*"]
                for a in arrivals:
                    price = f" — ₹{a['price']}" if a.get("price") else ""
                    lines.append(f"• *{a['name']}*{price}")
                    if a.get("short_description") or a.get("description"):
                        desc = (a.get("short_description") or a.get("description") or "")[:80]
                        lines.append(f"  {desc}")
                response_text = "\n".join(lines)
            else:
                response_text = "No new arrivals yet. Check back soon!"
        except Exception as e:
            logger.error(f"Failed to fetch new arrivals for {wa_id}: {e}")
            response_text = "No new arrivals yet. Check back soon!"
        if config.SEND2_USERNAME and config.SEND2_PASSWORD:
            send_whatsapp_message(wa_id, response_text)
        save_chat(wa_id, sender_name, action["title"], response_text, "new_arrivals")
        logger.info(f"BUTTON_NEW_ARRIVALS | {wa_id} | count={len(arrivals) if arrivals else 0}")
        return True

    if kind == "question" and payload:
        # Re-run the pipeline with the action's payload as the query.
        response = await process_message(payload, wa_id)
        response_text = response.get("answer", "")
        media_url = response.get("media_url")
        media_type = response.get("media_type")
        save_chat(wa_id, sender_name, action["title"], response_text, response.get("query_type", "faq"))
        if config.SEND2_USERNAME and config.SEND2_PASSWORD:
            interactive = response.get("interactive")
            if interactive and interactive.get("type") == "button" and interactive.get("buttons"):
                sent = send_whatsapp_interactive(wa_id, response_text, interactive["buttons"])
                if sent and media_url and any(
                    b.get("reply", {}).get("id") == DOCUMENT_BUTTON_ID for b in interactive["buttons"]
                ):
                    _pending_docs[wa_id] = {
                        "url": media_url, "type": media_type or "document", "created_at": time.time(),
                    }
                if not sent:
                    send_whatsapp_message(wa_id, response_text)
            else:
                media_type_n = _bot_media_type(media_type)
                if media_url and media_type_n and config.SEND_MEDIA:
                    media_url = _resolve_public(media_url)
                    if not send_whatsapp_message(wa_id, media_url, media_type_n):
                        send_whatsapp_message(wa_id, response_text)
                else:
                    send_whatsapp_message(wa_id, response_text)
            await log_outgoing_message(wa_id, response_text, "text")
        logger.info(f"BUTTON_QUESTION | {wa_id} | action={action['id']} | payload={payload[:60]}")
        return True

    return False


def _is_duplicate(msg_id: str) -> bool:
    if not msg_id:
        return False
    if msg_id in _processed_ids:
        return True
    _processed_ids.add(msg_id)
    if len(_processed_ids) > 5000:
        _processed_ids.clear()
    return False


async def _process_and_reply(wa_id, sender_name, user_text, msg_type, message, msg_id):
    start_time = time.time()
    try:
        # ── CHECK HUMAN HANDOVER ────────────────────────────────────────
        # While a human agent is handling the conversation, still save the
        # message so it appears in the agent inbox, BUT also let the bot
        # keep answering so the chat is never stuck.
        if _is_handover_active(wa_id):
            logger.info(f"HANDOVER_ACTIVE | {wa_id} | saving for agent, bot continues")
            save_chat(wa_id, sender_name, user_text, "", "human_handover")

        # ── CHECK IF USER WANTS A HUMAN AGENT ───────────────────────────
        if _wants_human_agent(user_text):
            _set_human_handover(wa_id, enabled=True)
            save_chat(wa_id, sender_name, user_text, HANDOVER_CONFIRMATION, "human_handover")
            if config.SEND2_USERNAME and config.SEND2_PASSWORD:
                send_whatsapp_message(wa_id, HANDOVER_CONFIRMATION)
            logger.info(f"HANDOVER_TRIGGERED | {wa_id} | user requested human agent")
            return

        # ── COMPLAINT FORM (multi-step) ─────────────────────────────────
        # An in-progress complaint form consumes the message directly so the
        # next form field is captured (no LLM / FAQ pipeline involvement).
        if complaint_flow.handle_complaint_state(wa_id, user_text):
            log_webhook("incoming", "/webhook/complaint", json.dumps({
                "wa_id": wa_id, "message": user_text
            }), 200, "Complaint form step")
            return

        # "raise complaint" / complaint keywords start the form.
        if complaint_flow.is_complaint_start(user_text):
            complaint_flow.start_complaint(wa_id)
            save_chat(wa_id, sender_name, user_text, "[complaint form started]", "complaint")
            await log_incoming_message(wa_id, user_text, msg_type)
            logger.info(f"COMPLAINT_STARTED | {wa_id} | {user_text[:60]}")
            response_time_ms = int((time.time() - start_time) * 1000)
            log_webhook("incoming", "/webhook/complaint", json.dumps({
                "wa_id": wa_id, "message": user_text
            }), 200, "Complaint form started", response_time_ms=response_time_ms)
            return

        # Log incoming message to company API
        await log_incoming_message(wa_id, user_text, msg_type)

        if _is_doc_button_reply(message):
            doc = _pop_pending_doc(wa_id)
            if doc and config.SEND2_USERNAME and config.SEND2_PASSWORD:
                raw_url = doc.get("url", "")
                if raw_url.startswith(("http://", "https://")):
                    media_url = raw_url
                else:
                    from kb.services.whatsapp import resolve_public_media_url
                    media_url = resolve_public_media_url(raw_url) or _resolve_media_url(raw_url)
                doc_type = _bot_media_type(doc.get("type", "document"))
                if doc_type:
                    doc_sent = send_whatsapp_message(wa_id, media_url, doc_type)
                    send_status = "sent_document" if doc_sent else "failed_document"
                    # Log document sent to company API
                    if doc_sent:
                        await log_outgoing_message(wa_id, f"[Document sent: {media_url}]", doc.get("type", "document"))
                else:
                    doc_sent = False
                    send_status = "no_supported_media"
                    send_whatsapp_message(wa_id, "Sorry, that file type isn't available right now. Please ask your question again.")
            else:
                send_status = "no_pending_document"
                if config.SEND2_USERNAME and config.SEND2_PASSWORD:
                    send_whatsapp_message(
                        wa_id,
                        "Sorry, that document link has expired. Please ask your question again.",
                    )
                    # Log outgoing error message to company API
                    await log_outgoing_message(wa_id, "Document link expired", "text")
            save_chat(wa_id, sender_name, user_text, f"[document] {send_status}", "faq")
            response_time_ms = int((time.time() - start_time) * 1000)
            log_webhook("outgoing", "/webhook/reply", json.dumps({
                "to": wa_id, "response": "[document]"
            }), 200, f"Reply {send_status} to {sender_name}", response_time_ms=response_time_ms)
            return

        # ── ROUTE REGISTRY BUTTON PRESSES BY ID ─────────────────────────
        # Buttons generated from the button registry carry a machine id that
        # maps to an implemented action; execute it directly (no LLM).
        button_id, button_title = _extract_button_press(message)
        if button_id and button_id in BUTTON_REGISTRY:
            action = get_action(button_id)
            if action and await _handle_registry_button(wa_id, sender_name, action, start_time):
                response_time_ms = int((time.time() - start_time) * 1000)
                log_webhook("outgoing", "/webhook/button", json.dumps({
                    "to": wa_id, "button_id": button_id
                }), 200, f"Button {button_id} handled", response_time_ms=response_time_ms)
                return

        # Log incoming message to company API
        await log_incoming_message(wa_id, user_text, msg_type)

        response = await process_message(user_text, wa_id, raw_message=message)
        response_text = response.get("answer", "")

        # Log outgoing response to company API
        await log_outgoing_message(wa_id, response_text, msg_type)
        media_url = response.get("media_url")
        media_type = response.get("media_type")
        whatsapp_sent = response.get("whatsapp_sent", False)
        route = response.get("query_type", "faq")
        logger.info(f"process_message returned: media_url={media_url}, media_type={media_type}, whatsapp_sent={whatsapp_sent}")
        save_chat(wa_id, sender_name, user_text, response_text, route)

        send_status = "skipped"
        if whatsapp_sent:
            send_status = "sent_by_kb_bot"
            logger.info(f"KB bot already sent interactive reply to {wa_id}")
        elif config.SEND2_USERNAME and config.SEND2_PASSWORD:
            interactive = response.get("interactive")
            is_direct = is_direct_media_query(user_text)

            if is_direct and config.SEND_MEDIA and media_url and media_type:
                # Option A: summary-first. Show a product summary with a
                # "Download Full PDF" button instead of dumping the raw PDF.
                # PDF is delivered later via the pending-doc mechanism when the
                # user taps the button. Falls back to legacy direct media when
                # no structured products exist.
                summary = build_catalog_summary(user_text)
                if summary:
                    if media_url and not media_url.startswith(("http://", "https://")):
                        from kb.services.whatsapp import resolve_public_media_url
                        media_url = resolve_public_media_url(media_url) or _resolve_media_url(media_url)
                    else:
                        media_url = _resolve_media_url(media_url)
                    sent = send_whatsapp_interactive(wa_id, summary["text"], summary["buttons"])
                    if sent:
                        _pending_docs[wa_id] = {
                            "url": media_url,
                            "type": media_type or "document",
                            "created_at": time.time(),
                        }
                        send_status = "sent_catalog_summary"
                        logger.info(f"CATALOG_SUMMARY_SENT | {wa_id} | pending_pdf={media_url[:80]}")
                    else:
                        # Interactive send failed: legacy direct media fallback.
                        media_type_n = _bot_media_type(media_type)
                        media_sent = bool(
                            send_whatsapp_message(wa_id, media_url, media_type_n) if media_type_n else False
                        )
                        if media_sent:
                            send_status = "sent_media"
                        else:
                            send_whatsapp_message(wa_id, response_text)
                            send_status = "sent_media_fallback_text"
                        logger.info(f"Summary send failed; direct media {'sent' if media_sent else 'failed, text fallback'} to {wa_id}")
                else:
                    if not media_url.startswith(("http://", "https://")):
                        from kb.services.whatsapp import resolve_public_media_url
                        media_url = resolve_public_media_url(media_url) or _resolve_media_url(media_url)
                    else:
                        media_url = _resolve_media_url(media_url)
                    media_type = _bot_media_type(media_type)
                    media_sent = bool(
                        send_whatsapp_message(wa_id, media_url, media_type) if media_type else False
                    )
                    if media_sent:
                        send_status = "sent_media"
                    else:
                        send_whatsapp_message(wa_id, response_text)
                        send_status = "sent_media_fallback_text"
                    logger.info(f"Direct media {'sent' if media_sent else 'failed, sent text fallback'} to {wa_id}: {media_type} {media_url}")
            elif interactive and interactive.get("type") == "button" and interactive.get("buttons"):
                buttons = interactive["buttons"]
                sent = send_whatsapp_interactive(wa_id, response_text, buttons)
                send_status = "sent_interactive" if sent else "failed_interactive"
                logger.info(f"Interactive button reply {'sent' if sent else 'failed'} to {wa_id}")
                if sent and media_url and any(
                    b.get("reply", {}).get("id") == DOCUMENT_BUTTON_ID for b in buttons
                ):
                    _pending_docs[wa_id] = {
                        "url": media_url,
                        "type": media_type or "document",
                        "created_at": time.time(),
                    }
                if not sent:
                    if media_url and media_type:
                        media_url = _resolve_media_url(media_url)
                        media_type = _bot_media_type(media_type)
                        media_sent = bool(
                            send_whatsapp_message(wa_id, media_url, media_type) if media_type else False
                        )
                        if media_sent:
                            send_status = "sent_media_fallback"
                        else:
                            send_whatsapp_message(wa_id, response_text)
                            send_status = "sent_text_fallback"
                    else:
                        send_whatsapp_message(wa_id, response_text)
                        send_status = "sent_text_fallback"
                    logger.info(f"Fallback after interactive fail: {send_status} to {wa_id}")
            elif interactive and interactive.get("type") == "list" and interactive.get("sections"):
                if response_text:
                    send_whatsapp_message(wa_id, response_text)
                list_sent = send_whatsapp_list_menu(
                    wa_id,
                    interactive.get("header", ""),
                    interactive.get("body", ""),
                    interactive.get("button_text") or interactive.get("button", "Menu"),
                    interactive.get("sections", []),
                    interactive.get("footer", ""),
                )
                send_status = "sent_list" if list_sent else "failed_list"
                logger.info(f"Interactive list reply {'sent' if list_sent else 'failed'} to {wa_id}")
            elif config.SEND_MEDIA and media_url and media_type:
                media_url = _resolve_media_url(media_url)
                media_type = _bot_media_type(media_type)
                send_whatsapp_message(wa_id, response_text)
                if media_type:
                    media_sent = send_whatsapp_message(wa_id, media_url, media_type)
                    send_status = "sent_media" if media_sent else "failed_media"
                else:
                    media_sent = False
                    send_status = "sent"
            else:
                send_whatsapp_message(wa_id, response_text)
                send_status = "sent"
        else:
            logger.info("SEND2 credentials not set - reply skipped (check .env)")

        response_time_ms = int((time.time() - start_time) * 1000)
        log_webhook("outgoing", "/webhook/reply", json.dumps({
            "to": wa_id, "response": response_text
        }), 200, f"Reply {send_status} to {sender_name}", response_time_ms=response_time_ms)
    except Exception as e:
        logger.error(f"Webhook processing error: {e}", exc_info=True)
        response_time_ms = int((time.time() - start_time) * 1000)
        log_webhook("incoming", "/webhook", json.dumps({"message_id": msg_id, "error": str(e)}), 500, f"Error: {e}", response_time_ms=response_time_ms)


@router.get("")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    logger.info(f"Webhook verification request: mode={hub_mode}, token={hub_verify_token}")
    log_webhook("incoming", "/webhook/verify", json.dumps({
        "hub_mode": hub_mode, "hub_verify_token": hub_verify_token, "hub_challenge": hub_challenge
    }), None, "Meta verification ping")

    if hub_mode == "subscribe" and hub_verify_token == config.WHATSAPP_VERIFY_TOKEN:
        logger.info("Webhook verified successfully")
        log_webhook("outgoing", "/webhook/verify", hub_challenge, 200, "Verification OK - returned challenge")
        return PlainTextResponse(content=str(hub_challenge))

    logger.warning(f"Webhook verification FAILED: mode={hub_mode}, token={hub_verify_token}")
    log_webhook("outgoing", "/webhook/verify", "Verification failed", 403, "Token mismatch")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("")
async def receive_webhook(request: Request, background_tasks: BackgroundTasks):
    # SECURITY FIX: Validate payload size before processing
    content_length = request.headers.get('content-length', '0')
    try:
        content_length_int = int(content_length)
    except ValueError:
        content_length_int = 0
    
    body = await request.body()
    body_length = len(body)
    
    # Validate size limits
    _validate_payload_size(content_length_int, body_length)
    
    raw_payload = body.decode("utf-8", errors="replace")
    logger.info(f"Incoming webhook payload ({len(raw_payload)} bytes)")
    
    # SECURITY FIX: For backward compatibility, log only truncated payload
    # The actual storage now uses hash via log_webhook function
    log_webhook("incoming", "/webhook", raw_payload[:5000], None, "Raw payload")

    try:
        payload = json.loads(body)
        # SECURITY FIX: Sanitize payload to limit resource usage
        payload = _sanitize_payload(payload)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON payload: {e}")
        log_webhook("incoming", "/webhook", raw_payload[:2000], 400, f"JSON decode error: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON")

    if payload.get("object") != "whatsapp_business_account":
        log_webhook("incoming", "/webhook", raw_payload[:2000], 200, f"Ignored non-WABA object: {payload.get('object')}")
        return {"status": "ignored", "object": payload.get("object")}

    entry = payload.get("entry") or [{}]
    changes = (entry[0].get("changes") or [{}])[0]
    value = changes.get("value") or {}

    if "statuses" in value:
        status = value["statuses"][0]
        logger.info(f"Status callback: id={status.get('id')} status={status.get('status')} "
                    f"timestamp={status.get('timestamp')}")
        log_webhook("incoming", "/webhook/status", json.dumps(status), 200,
                    f"Status: {status.get('status')} for msg_id: {status.get('id')}")
        return {"status": "ok", "type": "status"}

    if "messages" not in value:
        log_webhook("incoming", "/webhook", raw_payload[:3000], 200, "No messages or statuses in payload")
        return {"status": "no_messages"}

    message = value["messages"][0]
    contact = (value.get("contacts") or [{}])[0]

    wa_id = contact.get("wa_id", "")
    sender_name = (contact.get("profile") or {}).get("name", "Unknown")
    msg_type = message.get("type", "")
    msg_id = message.get("id", "")

    if msg_type == "text":
        user_text = message["text"]["body"]
    elif msg_type == "interactive":
        interactive = message.get("interactive", {})
        interactive_type = interactive.get("type", "")
        if interactive_type == "button_reply":
            user_text = interactive.get("button_reply", {}).get("title", "[Button]")
        elif interactive_type == "list_reply":
            user_text = interactive.get("list_reply", {}).get("title", "[List item]")
        else:
            user_text = f"[{msg_type}:{interactive_type}]"
        logger.info(f"Interactive reply: type={interactive_type} text={user_text[:100]}")
    else:
        user_text = f"[{msg_type} message]"

    logger.info(f"Incoming message from {sender_name} ({wa_id}): {user_text[:100]}")
    log_webhook("incoming", "/webhook/message", json.dumps({
        "wa_id": wa_id, "sender_name": sender_name, "type": msg_type,
        "message": user_text, "message_id": msg_id
    }), 200, f"Message from {sender_name}")

    if _is_duplicate(msg_id):
        logger.info(f"Skipping duplicate message {msg_id}")
        return {"status": "ok", "type": "duplicate"}

    background_tasks.add_task(_process_and_reply, wa_id, sender_name, user_text, msg_type, message, msg_id)
    return {"status": "ok", "type": "accepted"}
