"""
Ingest the Leeway Softech website into the chatbot knowledge base.

Pipeline (100% local, no third-party LLM):
    website_crawler  ->  knowledge_base table  ->  BGE-M3 embeddings  ->  FAISS  ->  Ollama answer

Usage:
    python kb/ingest_website.py --dry-run                      # preview only
    python kb/ingest_website.py                                # full ingest + FAISS rebuild
    python kb/ingest_website.py --url https://www.leewaysoftech.com --max-pages 200

Re-running the script is safe: with --refresh (default on) it first deletes
all previous website-sourced documents (source LIKE 'website:%') so pages are
not duplicated on every re-crawl.
"""

import os
import sys
import argparse
import logging

# Make project-root imports (routing.config, services.*) work when run from repo root
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_kb_dir = os.path.dirname(os.path.abspath(__file__))
for _p in (_project_root, os.path.join(_project_root, "routing"), _kb_dir):
    if _p not in sys.path:
        sys.path.insert(0, _p)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("ingest_website")

from website_crawler import crawl_website  # noqa: E402


def _delete_previous_website_docs() -> int:
    import sqlite3
    from routing.config import DB_PATH

    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.execute("DELETE FROM knowledge_base WHERE source LIKE 'website:%'")
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


def ingest(website_url: str, max_pages: int, delay: float,
           category: str, dry_run: bool, refresh: bool, render_js: bool = True) -> None:
    logger.info("Crawling %s (max %d pages, js_render=%s)",
                website_url, max_pages, render_js)
    pages = crawl_website(website_url, max_pages=max_pages, delay=delay,
                          render_js=render_js)

    if not pages:
        logger.error("No pages crawled - check the URL or whether the site requires JavaScript")
        return

    total_chars = sum(len(p["text"]) for p in pages)
    logger.info("Crawled %d usable pages (%d chars total)", len(pages), total_chars)

    if dry_run:
        for page in pages:
            print(f"[DRY-RUN] {page['title'] or '(untitled)'} | {page['url']} "
                  f"({len(page['text'])} chars)")
        print(f"\nDRY-RUN complete: {len(pages)} pages would be ingested. "
              "Re-run without --dry-run to write them into the knowledge base.")
        return

    # Import RAG only after the dry-run check so --dry-run works without
    # heavy deps (torch/sentence-transformers) being loaded.
    from services.rag import add_document_to_kb, rebuild_faiss_index

    if refresh:
        removed = _delete_previous_website_docs()
        if removed:
            logger.info("Removed %d previous website documents", removed)

    added, failed = 0, 0
    for page in pages:
        title = page["title"] or page["url"].rstrip("/").split("/")[-1] or "Website page"
        source = f"website:{page['url']}"
        # Prefix the URL as a citation line so answers can point back to the site
        text = f"Source URL: {page['url']}\nPage: {title}\n\n{page['text']}"
        result = add_document_to_kb(source, text, category=category)
        if result.get("success"):
            added += 1
            logger.info("Ingested '%s' (%d chunks) [%s]",
                        title, result["chunks"], page["url"])
        else:
            failed += 1
            logger.warning("Failed to ingest %s: %s", page["url"], result.get("error"))

    logger.info("Rebuilding FAISS index...")
    rebuild_faiss_index()

    print(f"\nDone. {added} pages ingested into knowledge_base "
          f"(category='{category}', {failed} failed). FAISS index rebuilt.")
    if failed:
        print(f"WARNING: {failed} pages failed to ingest - check logs above.")


def main():
    parser = argparse.ArgumentParser(description="Ingest website content into the chatbot KB")
    parser.add_argument("--url", default=os.getenv("WEBSITE_CRAWL_URL", "https://www.leewaysoftech.com"))
    parser.add_argument("--max-pages", type=int,
                        default=int(os.getenv("WEBSITE_CRAWL_MAX_PAGES", "150")))
    parser.add_argument("--delay", type=float,
                        default=float(os.getenv("WEBSITE_CRAWL_DELAY", "0.5")))
    parser.add_argument("--category", default="Website",
                        help="KB category label for ingested pages")
    parser.add_argument("--dry-run", action="store_true",
                        help="Crawl and print what would be ingested, write nothing")
    parser.add_argument("--no-refresh", dest="refresh", action="store_false",
                        help="Keep old website documents instead of replacing them")
    parser.add_argument("--no-render", dest="render_js", action="store_false",
                        help="Disable headless-browser rendering (plain HTTP only)")
    args = parser.parse_args()

    ingest(args.url, args.max_pages, args.delay, args.category,
           dry_run=args.dry_run, refresh=args.refresh, render_js=args.render_js)


if __name__ == "__main__":
    main()
