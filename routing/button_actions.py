"""
Fixed TOPIC_SUGGESTIONS + button map + matcher + topic-relevance guard.

Bugs in the original:
1. Typos in `source`: "copmany_policy" -> "company_policy",
   "terms_condition" -> "terms_conditions" (source filter never matched).
2. No dedicated groups for `credit period` and `moq`.
   `moq` was buried inside the generic price group.
3. Distributor group was too weak (few keywords, wrong actions —
   `new_arrival` is irrelevant for distributorship queries).
4. ORDERING BUG (the main "buttons aren't matching" cause):
   generic groups with keywords like "order" / "product" / "terms"
   were evaluated before specific ones, so e.g.
   - "net 30 payment terms?" matched the TERMS group (bare "terms")
     instead of the CREDIT group ("payment terms");
   - "where is my order?" matched the ORDER group instead of TRACKING.
   Fix: most-specific groups first (credit -> moq -> distributor ->
   privacy -> terms -> ... -> generic price/ingredients last).
5. Over-generic keywords ("order", "product", "data", "law", "policies",
   "terms", "conditions", "credit") matched almost everything under
   naive `if kw in query` checks.
   Fix: matcher below uses word-boundaries + longest-phrase-first,
   and bare generic words were removed or converted to phrases.

6. MISSING GUARD (why UNRELATED buttons reached users):
   service.py calls `enforce_topic_actions(validated, query, limit=3)`
   from this module to drop/replace LLM-picked buttons that are unrelated
   to the user's query (e.g. "✨ New Arrivals" on a credit-period answer),
   but the function NEVER EXISTED in this file. The ImportError was
   swallowed by service.py's broad `except Exception`, so:
     - the relevance filter silently never ran, AND
     - BUTTON_REGISTRY silently came back empty on that import path.
   Fix: implemented below in §3b — this is the guard that makes buttons
   match what the user actually asked.

7. WHATSAPP 20-CHAR TITLE LIMIT:
   Five registry titles exceeded 20 characters, so handle_faq_query's
   `title[:20]` slice chopped them mid-word ("🧾 Order, Payment & G",
   "🥜 Ingredients & Nut", ...). Titles are now all <= 20 chars and
   validate() enforces the limit so this can't regress.

Rule of thumb: if group A's keyword is a SUBSTRING of group B's keyword
("terms" vs "payment terms", "order" vs "cancel order"), B must come first
OR A must not use the bare substring. This file does both.
"""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# 1. Canonical button map — EVERY action id used below MUST exist here.
#    "Suggested buttons aren't matching" almost always means:
#    TOPIC_SUGGESTIONS references an id with no button definition.
#    NOTE: titles must stay <= 20 chars (WhatsApp reply-button limit).
# ---------------------------------------------------------------------------

BUTTONS: dict[str, str] = {
    # policies / support
    "privacy_policy": "🔒 Privacy Policy",
    "terms_conditions": "📄 Terms & Conditions",
    "company_policy": "🏢 Company Policies",
    "contact_support": "💬 Contact Support",
    # orders / logistics
    "return_policy": "🔁 Returns & Refunds",      # was "↩️ Return & Refund Policy" (25 chars, got chopped)
    "track_order": "📦 Track Order",
    "shipping_policy": "🚚 Shipping Policy",       # was "🚚 Shipping & Delivery" (21 chars)
    "order_policy": "🧾 Orders & Payments",        # was "🧾 Order, Payment & GST" (22 chars)
    # products
    "product_prices": "💰 Product Prices",
    "new_arrival": "✨ New Arrivals",
    "product_ingredients": "🥜 Ingredients Info",  # was "🥜 Ingredients & Nutrition" (25 chars)
    "allergen_info": "⚠️ Allergen Info",
    "shelf_life": "📅 Shelf Life",                 # was "📅 Shelf Life & Storage" (22 chars)
    # B2B
    "moq_policy": "📊 MOQ & Bulk Orders",
    "credit_period_policy": "💳 Credit Period",    # was "💳 Credit Period & Terms" (23 chars)
    "distributor_info": "🤝 Distributorship",
}

# ---------------------------------------------------------------------------
# 2. Topic groups — ORDER IS LOAD-BEARING. Specific -> generic.
#    Evaluated top-down; every matching group contributes its actions
#    until we have `top_k` unique actions.
# ---------------------------------------------------------------------------

TOPIC_SUGGESTIONS: list[dict] = [
    # ---- 1. Most specific B2B topics FIRST (before terms/order/price) ----
    {
        # NOTE: no bare "credit" — it false-matched "credit card" payment queries.
        # NOTE: sits BEFORE the terms group — "payment terms" contains "terms".
        "keywords": [
            "credit period", "credit days", "credit limit", "credit facility",
            "payment terms", "payment deadline", "net 30", "net-30", "net days",
            "due date", "on credit", "udhar",
        ],
        "source": [],
        "actions": ["credit_period_policy", "order_policy", "contact_support"],
    },
    {
        # NOTE: sits BEFORE order/price — "minimum order" contains "order".
        "keywords": [
            "minimum order quantity", "minimum order value", "minimum order",
            "minimum quantity", "minimum purchase", "order quantity",
            "moq", "mov", "min order",
        ],
        "source": [],
        "actions": ["moq_policy", "credit_period", "contact_support"],
    },
    {
        "keywords": [
            "become a distributor", "become a partner", "distributorship",
            "distributor", "distribution", "stockist", "super stockist",
            "dealership", "dealer", "reseller", "wholesale", "franchise",
            "partnership", "trade partner", "agency", "carry your products",
        ],
        "source": [],
        "actions": ["moq_policy", "credit_period", "contact_support"],
    },
    # ---- 2. Policy topics ----
    {
        # NOTE: removed bare "data" (matched everything); use "data privacy".
        "keywords": ["privacy", "personal information", "cookie", "gdpr", "data privacy"],
        "source": [],
        "actions": ["company_policy", "terms_conditions", "contact_support"],
    },
    {
        # NOTE: removed bare "terms"/"conditions" (they hijacked "payment terms").
        # Use phrases instead.
        "keywords": [
            "terms and conditions", "terms of use", "terms of service",
            "t&c", "tnc", "disclaimer", "agreement",
        ],
        "source": [],  # fixed: was "terms_condition"
        "actions": ["company_policy", "privacy_policy", "refund_return_policy"],
    },
    {
        # NOTE: removed bare "policies"/"law" (false-matched every "* policy" query).
        "keywords": [
            "company policy", "channel policy", "workplace policy",
            "anti-bribery", "anti bribery", "anti-discrimination",
            "anti-counterfeit", "sustainability", "governed by", "jurisdiction",
        ],
        "source": [],  # fixed: was "copmany_policy"
        "actions": ["shipping_policy", "privacy_policy", "terms_conditions"],
    },
    # ---- 3. Order lifecycle: return -> cancel -> tracking -> payment ----
    {
        "keywords": [
            "return", "refund", "replace", "replacement",
            "damaged", "money back", "wrong item", "defective", "expired item",
        ],
        "source": [],
        "actions": ["return_return_policy", "track_order", "contact_support"],
    },
    {
        # NOTE: split out of the old generic "order" group and placed BEFORE
        # tracking — "cancel my order" contains "my order".
        "keywords": ["cancel order", "cancel my order", "cancellation", "cancel"],
        "source": [],
        "actions": ["order_policy", "track_order", "return_cancellation_policy"],
    },
    {
        # NOTE: owns "my order" / "where is my order" / "order id" now.
        "keywords": [
            "where is my order", "track order", "order status", "order tracking",
            "my order", "order id", "tracking", "shipping", "delivery",
            "dispatch", "courier", "logistics", "transit", "shipment",
            "delivery charge", "shipping charge",
        ],
        "source": [],
        "actions": ["track_order", "shipping_policy", "contact_support"],
    },
    {
        # NOTE: payment/GST half of the old generic "order" group.
        # No bare "order" here anymore — tracking owns order-status queries.
        # NOTE: "track_order" REMOVED from actions — a GST/UPI/invoice question
        # used to also offer "📦 Track Order", which felt unrelated to what the
        # user asked. If order tracking is genuinely relevant, the cancel group
        # or the tracking group supplies it.
        "keywords": [
            "payment method", "credit card", "debit card", "upi",
            "payment", "pay", "gst", "invoice", "billing", "receipt",
        ],
        "source": [],
        "actions": ["order_policy", "contact_support"],
    },
    # ---- 4. Generic product topics LAST ----
    {
        # NOTE: "moq" removed — it has its own group now.
        "keywords": [
            "price", "pricing", "cost", "rate", "quote", "quotation",
            "bulk order", "bulk", "discount", "offer", "deal", "price list",
        ],
        "source": [],
        "actions": ["credit_period", "moq_policy", "contact_support"],
    },
    {
        "keywords": [
            "shelf life", "best before", "expiry", "expire", "mfg date",
            "manufacturing date", "fresh", "storage", "how to store",
        ],
        "source": [],
        "actions": ["shelf_life", "product_ingredients", "contact_support"],
    },
    {
        # NOTE: removed bare "product"/"chikki" — they matched everything.
        # Keep LAST as a fallback for product questions.
        "keywords": [
            "ingredient", "nutrition", "nutritional", "allergen", "allergy",
            "gluten", "sugar", "jaggery", "vegan", "flavour", "flavor",
            "catalogue", "catalog", "composition", "recipe", "calorie",
        ],
        "source": [],
        "actions": ["product_ingredients", "product_nutrition", "new_arrival"],
    },
]

# ---------------------------------------------------------------------------
# 3. Matcher — word-boundary aware, longest-phrase-first.
#    Drop-in replacement for naive `if kw in query` checks.
# ---------------------------------------------------------------------------

def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def _keyword_hit(keyword: str, query: str) -> bool:
    """Match whole words/phrases, not substrings ('order' won't hit 'reorder')."""
    return re.search(r"\b" + re.escape(keyword.lower()) + r"\b", query) is not None


def get_suggestions(query: str, top_k: int = 3) -> list[str]:
    """
    Return up to `top_k` unique action ids for a user query.
    Groups are evaluated top-down (specific -> generic); every matching
    group contributes its actions in order.
    """
    q = _normalize(query)
    picked: list[str] = []

    for group in TOPIC_SUGGESTIONS:
        # Longest keywords first: "credit period" beats "credit",
        # "cancel order" beats "cancel", "payment terms" beats "payment".
        for kw in sorted(group["keywords"], key=len, reverse=True):
            if _keyword_hit(kw, q):
                for action in group["actions"]:
                    if action not in picked:
                        picked.append(action)
                        if len(picked) >= top_k:
                            return picked
                break  # one hit per group is enough

    return picked


def get_suggestion_buttons(query: str, top_k: int = 3) -> list[dict[str, str]]:
    """Convenience: return [{id, label}] ready for the chat UI."""
    return [{"id": a, "label": BUTTONS[a]} for a in get_suggestions(query, top_k) if a in BUTTONS]


# ---------------------------------------------------------------------------
# 3b. Topic-relevance guard — REQUIRED by service.py.
#     service._validate_faq_dynamic_result() does:
#         from routing.button_actions import BUTTON_REGISTRY, enforce_topic_actions
#         validated = enforce_topic_actions(validated, query, limit=3)
#     This is the function that was missing (see docstring note 6). It keeps
#     only buttons topically related to the user's query, so the LLM can no
#     longer attach off-topic buttons to an answer.
# ---------------------------------------------------------------------------

def enforce_topic_actions(
    buttons: list[dict],
    query: str,
    limit: int = 3,
) -> list[dict]:
    """
    Keep only buttons related to what the user asked; backfill from the
    keyword matcher in topic-relevance order.

    Flow:
      1. Build a topic pool for the query with get_suggestions()
         (top_k = limit * 2 so a 2nd matching group can contribute).
      2. Pool empty (no keyword hit at all)  -> pass the LLM's picks through
         unchanged; there is no topic signal to judge them by.
      3. Pool non-empty                      -> output is the pool (in
         keyword-relevance order), but LLM picks inside the pool choose
         WHICH pool members appear when the pool is larger than `limit`.
         Off-topic LLM picks are always dropped.

    Called by service.py as enforce_topic_actions(validated, query, limit=3).
    """
    if limit <= 0:
        return []

    buttons = buttons or []
    pool = get_suggestions(query or "", top_k=limit * 2)

    if not pool:
        # No keyword signal — keep the registry-valid LLM picks as-is.
        return [
            {"id": (b.get("id") or "").strip()[:50], "title": (b.get("title") or "")[:20]}
            for b in buttons[:limit]
            if (b.get("id") or "").strip()
        ]

    pool_set = set(pool)
    picked = {
        (b.get("id") or "").strip()
        for b in buttons
        if (b.get("id") or "").strip() in pool_set
    }

    # LLM's relevant picks first (ordered by pool relevance), then backfill.
    ordered = [bid for bid in pool if bid in picked]
    for bid in pool:
        if len(ordered) >= limit:
            break
        if bid not in ordered:
            ordered.append(bid)

    return [
        {"id": bid[:50], "title": BUTTONS.get(bid, bid)[:20]}
        for bid in ordered[:limit]
    ]


def validate() -> list[str]:
    """Every referenced action must have a button (<= 20-char title). Returns errors."""
    errors: list[str] = []
    for i, group in enumerate(TOPIC_SUGGESTIONS):
        for action in group["actions"]:
            if action not in BUTTONS:
                errors.append(f"group[{i}] references unknown action: {action!r}")
    for bid, label in BUTTONS.items():
        if len(label) > 20:
            errors.append(
                f"button {bid!r} title exceeds WhatsApp 20-char limit "
                f"({len(label)} chars): {label!r}"
            )
    return errors


# ---------------------------------------------------------------------------
# 4. Quick self-test — run:  python button_actions.py
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    assert not validate(), validate()

    tests = {
        # NEW topics
        "What is your credit period?": ["credit_period_policy", "order_policy", "contact_support"],
        "Do you offer net 30 payment terms?": ["credit_period_policy", "order_policy", "contact_support"],
        "What is the MOQ for bulk order?": ["moq_policy", "product_prices", "contact_support"],
        "minimum order quantity for chikki?": ["moq_policy", "product_prices", "contact_support"],
        "How to become a distributor?": ["distributor_info", "product_prices", "contact_support"],
        "I want distributorship in Gujarat": ["distributor_info", "product_prices", "contact_support"],
        # regression tests — these broke with naive ordering/substring matching
        "Where is my order?": ["track_order", "shipping_policy", "contact_support"],
        "cancel my order": ["order_policy", "track_order", "contact_support"],
        # updated: payment group no longer drags in Track Order for a payments question
        "can I pay by credit card?": ["order_policy", "contact_support"],
        "what are your terms and conditions?": ["terms_conditions", "privacy_policy", "contact_support"],
        "I want refund for damaged item": ["return_policy", "track_order", "contact_support"],
        "Send price list": ["product_prices", "moq_policy", "contact_support"],
        "Is it gluten free? ingredients?": ["product_ingredients", "allergen_info", "new_arrival"],
        "What is shelf life?": ["shelf_life", "product_ingredients", "contact_support"],
        "privacy policy": ["privacy_policy", "terms_conditions", "contact_support"],
    }

    failed = 0
    for query, expected in tests.items():
        got = get_suggestions(query)
        ok = got == expected
        failed += not ok
        print(f"{'✅' if ok else '❌'} {query!r}\n   got={got} expected={expected}")

    # ── enforce_topic_actions: off-topic LLM picks get replaced ──
    print("\nenforce_topic_actions checks:")

    # LLM picked nothing relevant for a credit-period answer -> full topic swap
    got = enforce_topic_actions(
        [{"id": "new_arrival", "title": "✨ New Arrivals"},
         {"id": "product_prices", "title": "💰 Product Prices"}],
        "What is your credit period?",
    )
    ok = [b["id"] for b in got] == ["credit_period_policy", "order_policy", "contact_support"]
    failed += not ok
    print(f"{'✅' if ok else '❌'} unrelated LLM picks replaced\n   got={[b['id'] for b in got]}")

    # relevant LLM pick survives (and chooses which pool members fill the rest)
    got = enforce_topic_actions(
        [{"id": "credit_period_policy", "title": "💳 Credit Period"},
         {"id": "new_arrival", "title": "✨ New Arrivals"}],
        "Do you offer net 30 payment terms?",
    )
    ok = [b["id"] for b in got] == ["credit_period_policy", "order_policy", "contact_support"]
    failed += not ok
    print(f"{'✅' if ok else '❌'} relevant LLM pick kept + backfilled\n   got={[b['id'] for b in got]}")

    # GST question no longer offers Track Order
    got = enforce_topic_actions(
        [{"id": "contact_support", "title": "💬 Contact Support"},
         {"id": "contact_support", "title": "💬 Contact Support"}],
        "what is gst on your products?",
    )
    ok = [b["id"] for b in got] == ["contact_support", "order_policy"]
    failed += not ok
    print(f"{'✅' if ok else '❌'} GST query -> no Track Order, dupes removed\n   got={[b['id'] for b in got]}")

    # no keyword signal -> LLM picks pass through untouched
    got = enforce_topic_actions([{"id": "new_arrival", "title": "✨ New Arrivals"}], "hello")
    ok = [b["id"] for b in got] == ["new_arrival"]
    failed += not ok
    print(f"{'✅' if ok else '❌'} empty pool -> LLM picks pass through\n   got={[b['id'] for b in got]}")

    print(f"\n{failed == 0 and 'ALL PASSED ✅' or f'{failed} CHECK(S) FAILED ❌'}")

# ─────────────────────────────────────────────
# Backwards-compatibility shims
# webhook.py and other modules import these legacy names from
# routing.button_actions. They are thin wrappers over the new
# BUTTONS / TOPIC_SUGGESTIONS data defined above.
# ─────────────────────────────────────────────

# Legacy registry shape: id -> {"id": ..., "title": ...}
BUTTON_REGISTRY: dict[str, dict] = {
    bid: {"id": bid, "title": label} for bid, label in BUTTONS.items()
}


def get_action(action_id: str) -> dict | None:
    """Legacy accessor used by routing/webhook.py. Returns spec or None."""
    if not action_id:
        return None
    return BUTTON_REGISTRY.get(action_id.strip())


def registry_prompt_text() -> str:
    """Legacy helper: allowed-buttons list for the LLM prompt."""
    return "\n".join(
        f'- "{bid}" -> "{spec["title"]}"' for bid, spec in BUTTON_REGISTRY.items()
    )


def suggest_actions(query: str, source_file: str = "") -> list[dict]:
    """Legacy helper returning [{"id", "title"}]."""
    out = [
        {"id": s["id"], "title": s.get("label", s["id"])}
        for s in get_suggestion_buttons(query, top_k=3)
    ]
    if out or not source_file:
        return out
    sf = source_file.lower()
    for group in TOPIC_SUGGESTIONS:
        for src in group.get("source", []) or []:
            if src and src.lower() in sf:
                return [
                    {"id": a, "title": BUTTONS.get(a, a)}
                    for a in group.get("actions", [])[:3]
                    if a in BUTTONS
                ]
    return out
