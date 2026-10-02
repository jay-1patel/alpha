"""Phase 0.4 exit test: every similarity query filters by tenant.

Run from the repo root with the venv python:
    ./venv/Scripts/python.exe scratchpad/test_tenant_isolation.py
Cleans up its own test data at the end.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
# backend/ must come AFTER the root: `routing` and `kb` resolve from the root,
# while `database` (backend/database.py) needs backend/ on the path too.
sys.path.append(os.path.join(ROOT, "backend"))

PASS, FAIL = [], []


def check(name, cond):
    (PASS if cond else FAIL).append(name)
    print(f"{'PASS' if cond else 'FAIL'}: {name}")


def main():
    import sqlite3
    from kb.services.rag import (
        add_document_to_kb, rebuild_faiss_index, search_kb_faiss,
        rebuild_product_faiss_index, search_products_faiss,
    )

    DB = os.path.join(ROOT, "FAQ.DB")

    # ── KB index ──────────────────────────────────────────────────────
    rebuild_faiss_index()
    rebuild_product_faiss_index()

    hits_def = search_kb_faiss("product information", limit=3)
    hits_tg = search_kb_faiss("product information", limit=3, tenant_id="troogood")
    hits_other = search_kb_faiss("product information", limit=3, tenant_id="otherco")
    check("kb: default-tenant fallback returns results", len(hits_def) > 0)
    check("kb: troogood tenant returns results", len(hits_tg) > 0)
    check("kb: unknown tenant returns nothing (isolation)", hits_other == [])

    # ── product index ─────────────────────────────────────────────────
    p_def = search_products_faiss("product", limit=3)
    p_tg = search_products_faiss("product", limit=3, tenant_id="troogood")
    p_other = search_products_faiss("product", limit=3, tenant_id="otherco")
    check("products: default-tenant fallback returns results", len(p_def) > 0)
    check("products: troogood tenant returns results", len(p_tg) > 0)
    check("products: unknown tenant returns nothing (isolation)", p_other == [])

    # ── add_document tags the tenant; search cannot cross ────────────
    doc = add_document_to_kb(
        "tenant_iso_test.txt",
        "Leewaysoftech builds custom web applications with Python and React for enterprise clients.",
        tenant_id="tenant-iso-test",
    )
    check("add_document: succeeds and returns doc_id", doc.get("success") and doc.get("doc_id"))
    rebuild_faiss_index()  # index the new doc before searching

    doc_id = doc["doc_id"]
    iso_hits = search_kb_faiss("leewaysoftech web applications", limit=3, tenant_id="tenant-iso-test")
    tg_hits = search_kb_faiss("leewaysoftech web applications", limit=3, tenant_id="troogood")
    check("add_document: owning tenant finds the doc", any(h["doc_id"] == doc_id for h in iso_hits))
    # No score threshold in search_kb_faiss, so TrooGood may get weak hits —
    # isolation means none of them may be the other tenant's doc.
    check("add_document: troogood cannot see other tenant's doc",
          all(h["doc_id"] != doc_id for h in tg_hits))

    # ── FAQ index (hybrid dense+BM25+rerank) ─────────────────────────
    from backend.faq.service import faq_index, _fetch_module_full_content
    faq_index.build(force=True)

    f_def = faq_index.search("shipping policy", k=5)
    f_tg = faq_index.search("shipping policy", k=5, tenant_id="troogood")
    f_other = faq_index.search("shipping policy", k=5, tenant_id="otherco")
    check("faq: default-tenant fallback returns results", len(f_def) > 0)
    check("faq: troogood tenant returns results", len(f_tg) > 0)
    check("faq: unknown tenant returns nothing (isolation)", f_other == [])

    listing_tg = _fetch_module_full_content(("catalogue",), tenant_id="troogood")
    listing_other = _fetch_module_full_content(("catalogue",), tenant_id="otherco")
    check("listing: troogood module content fetched", bool(listing_tg))
    check("listing: unknown tenant gets no module content", not listing_other)

    # ── search_products (database.py) tenant scoping ──────────────────
    from database import search_products
    s_def = search_products("protein", limit=3)
    s_tg = search_products("protein", limit=3, tenant_id="troogood")
    s_other = search_products("protein", limit=3, tenant_id="otherco")
    check("db search_products: default tenant works", isinstance(s_def, list))
    check("db search_products: troogood returns products", len(s_tg) > 0)
    check("db search_products: unknown tenant returns nothing", s_other == [])

    # ── cleanup ───────────────────────────────────────────────────────
    conn = sqlite3.connect(DB)
    conn.execute("DELETE FROM knowledge_base WHERE title = 'tenant_iso_test.txt'")
    conn.commit()
    conn.close()
    rebuild_faiss_index()
    print("cleanup: removed tenant_iso_test.txt doc and rebuilt index")

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        sys.exit(1)


if __name__ == "__main__":
    main()
