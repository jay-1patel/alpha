# One-off rebrand script: TrooGood/Chiki -> Leeway Softtech
import io
import sys

BASE = r"C:\Users\Leeway\Desktop\chatbot2"

# (relative path, old, new, expected count)
REPLACEMENTS = [
    # --- config ---
    (r"routing\config.py", '"TrooGood Product Catalogue.pdf"', '"Leeway Softtech Product Catalogue.pdf"', 1),
    (r"backend\routing\config.py", '"TrooGood Product Catalogue.pdf"', '"Leeway Softtech Product Catalogue.pdf"', 1),
    # --- classifier ---
    (r"routing\classifier.py", '"about troogood"', '"about leeway softtech"', 2),
    (r"backend\routing\classifier.py", '"about troogood"', '"about leeway softtech"', 2),
    # --- message keywords ---
    (r"routing\message.py", '"about troogood"', '"about leeway softtech"', 1),
    (r"routing\message.py", '"when was troogood founded", "troogood story"', '"when was leeway softtech founded", "leeway softtech story"', 1),
    (r"routing\message.py", '"tell me about troogood", "what is troogood"', '"tell me about leeway softtech", "what is leeway softtech"', 1),
    (r"backend\routing\message.py", '"about troogood"', '"about leeway softtech"', 1),
    (r"backend\routing\message.py", '"when was troogood founded", "troogood story"', '"when was leeway softtech founded", "leeway softtech story"', 1),
    (r"backend\routing\message.py", '"tell me about troogood", "what is troogood"', '"tell me about leeway softtech", "what is leeway softtech"', 1),
    # --- menu service fallback brand ---
    (r"backend\services\menu_service.py", 'return BRAND_NAME or "TrooGood"', 'return BRAND_NAME or "Leeway Softtech"', 1),
    (r"backend\services\menu_service.py", 'return "TrooGood"', 'return "Leeway Softtech"', 1),
    # --- pdf product stopwords ---
    (r"backend\services\pdf_products.py", '"best", "startup", "india", "troogood", "www.", "do good",', '"best", "startup", "india", "leeway", "softtech", "www.", "do good",', 1),
    # --- kb brain prompt example ---
    (r"kb\services\brain.py", "[TrooGood_Company_Details.pdf]", "[Company_Details.pdf]", 1),
    # --- kb handler ---
    (r"kb\services\kb_handler.py", "troogood_discount_flyer.pdf", "leeway_discount_flyer.pdf", 4),
    (r"kb\services\kb_handler.py", "Tell me about TrooGood company", "Tell me about Leeway Softtech company", 1),
    (r"kb\services\kb_handler.py", 'footer_text="TrooGood"', 'footer_text="Leeway Softtech"', 5),
    # --- kb tools ---
    (r"kb\services\tools.py", "for a TrooGood product", "for a Leeway Softtech product", 1),
    # --- FastAPI titles / loggers ---
    (r"backend\main.py", 'title="Chiki Unified Service"', 'title="Leeway Softtech Chatbot Service"', 1),
    (r"routing\main.py", 'title="Chiki Routing Module"', 'title="Leeway Softtech Routing Module"', 1),
    (r"backend\routing\main.py", 'title="Chiki Routing Module"', 'title="Leeway Softtech Routing Module"', 1),
    # --- admin panel (live copy) ---
    (r"whatsapp-admin\src\components\campaigns\campaign-builder.tsx", "TrooGood", "Leeway Softtech", 1),
    (r"whatsapp-admin\src\components\campaigns\campaign-builder.tsx", "troogood-catalog-2026.pdf", "leeway-softtech-catalog-2026.pdf", 1),
    (r"whatsapp-admin\src\components\menus\menus-tab.tsx", "Welcome to TrooGood", "Welcome to Leeway Softtech", 2),
    (r"whatsapp-admin\src\components\tester\whatsapp-tester.tsx", "'TrooGood Bot'", "'Leeway Softtech Bot'", 1),
    (r"whatsapp-admin\index.html", "Leeway Softech - WhatsApp Chatbot Admin", "Leeway Softtech - WhatsApp Chatbot Admin", 1),
]

# logger name renames (chiki_webhook -> leeway_webhook), one or more per file
LOGGER_FILES = [
    r"backend\routes\admin.py", r"backend\routes\auth.py", r"backend\routes\catalog.py",
    r"backend\routes\chat_admin.py", r"backend\routes\status.py",
    r"backend\routing\complaint_flow.py", r"backend\routing\webhook.py", r"backend\routing\whatsapp.py",
    r"backend\services\emailer.py", r"backend\services\rag.py", r"backend\database.py",
    r"routing\complaint_flow.py", r"routing\webhook.py", r"routing\whatsapp.py",
]

failures = []
changed = 0

for rel, old, new, expected in REPLACEMENTS:
    path = BASE + "\\" + rel
    with io.open(path, "r", encoding="utf-8") as f:
        text = f.read()
    count = text.count(old)
    if count != expected:
        failures.append(f"{rel}: expected {expected} of {old!r}, found {count}")
        continue
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text.replace(old, new))
    changed += 1

for rel in LOGGER_FILES:
    path = BASE + "\\" + rel
    with io.open(path, "r", encoding="utf-8") as f:
        text = f.read()
    n = text.count('"chiki_webhook"')
    if n == 0:
        failures.append(f"{rel}: no chiki_webhook logger found")
        continue
    with io.open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text.replace('"chiki_webhook"', '"leeway_webhook"'))
    changed += 1

print(f"files changed: {changed}")
if failures:
    print("FAILURES:")
    for f_ in failures:
        print("  -", f_)
    sys.exit(1)
print("all replacements applied with expected counts")
