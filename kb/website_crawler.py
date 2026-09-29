"""
Website crawler for the Leeway Softech knowledge base.

Crawls the company website (same-domain only), extracts readable text from
every HTML page and returns a list of page records that ingest_website.py
feeds into the knowledge_base table (RAG).

No third-party LLM is involved anywhere in this pipeline: retrieval is
local (BGE-M3 embeddings + FAISS) and answer generation is local (Ollama).

Dependencies: requests only (already in requirements.txt).
"""

import re
import os
import html
import time
import logging
import subprocess
import tempfile
from collections import deque
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests

logger = logging.getLogger("website_crawler")

USER_AGENT = "LeewaySoftech-ChatBot-Crawler/1.0 (+knowledge base ingestion)"

# Headless Chromium-based browsers that can render JavaScript SPAs.
# Probed in order; on Windows Edge ships with the OS, so no extra install
# is needed. Falls back to plain requests when none is found.
BROWSER_CANDIDATES = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
]

SKIP_EXTENSIONS = {
    ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
    ".mp4", ".mp3", ".avi", ".mov", ".zip", ".rar", ".7z", ".exe",
    ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".css", ".js",
    ".woff", ".woff2", ".ttf", ".eot", ".xml", ".json",
}

# Boilerplate blocks that add noise to RAG chunks
NOISE_PATTERNS = [
    r"^\s*(cookie|privacy policy|accept|dismiss|close)\s*$",
    r"^\s*(home|about us?|our services?|contact us?|portfolio|blog|careers?)\s*$",
]


def _is_html_url(url: str) -> bool:
    parsed = urlparse(url)
    path = parsed.path.lower()
    return not any(path.endswith(ext) for ext in SKIP_EXTENSIONS)


def _same_site(base_url: str, url: str) -> bool:
    base_host = urlparse(base_url).netloc.lower().replace("www.", "")
    host = urlparse(url).netloc.lower().replace("www.", "")
    return host == base_host


def _find_browser() -> str:
    for candidate in BROWSER_CANDIDATES:
        if os.path.isfile(candidate):
            return candidate
    return ""


class WebsiteCrawler:
    def __init__(self, base_url: str, max_pages: int = 150,
                 delay: float = 0.5, timeout: int = 15,
                 respect_robots: bool = True, render_js: bool = True):
        self.base_url = base_url.rstrip("/")
        self.max_pages = max_pages
        self.delay = delay
        self.timeout = timeout
        self.render_js = render_js
        self.browser_exe = _find_browser() if render_js else ""
        if render_js and not self.browser_exe:
            logger.warning("No headless browser found; JavaScript pages will yield little text. "
                           "Install Edge/Chrome or add Playwright.")
        # Separate temp profile per crawler so concurrent headless runs don't clash
        self._profile_dir = tempfile.mkdtemp(prefix="leeway_crawl_")
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self.robot_parser = None
        if respect_robots:
            rp = RobotFileParser()
            rp.set_url(urljoin(self.base_url, "/robots.txt"))
            try:
                rp.read()
                self.robot_parser = rp
            except Exception as exc:
                logger.warning("Could not read robots.txt: %s", exc)

    def _allowed(self, url: str) -> bool:
        if not _same_site(self.base_url, url):
            return False
        if not _is_html_url(url):
            return False
        if self.robot_parser is not None:
            try:
                return self.robot_parser.can_fetch(USER_AGENT, url)
            except Exception:
                return True
        return True

    def _render_with_browser(self, url: str):
        """Render a JavaScript page with headless Edge/Chrome and return the DOM."""
        cmd = [
            self.browser_exe,
            "--headless=old",           # 'old' mode supports --dump-dom reliably
            "--disable-gpu",
            "--no-sandbox",
            "--no-first-run",
            "--hide-scrollbars",
            f"--user-data-dir={self._profile_dir}",
            "--virtual-time-budget=10000",  # let SPA fetch + render finish
            "--dump-dom",
            url,
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, timeout=self.timeout + 20)
            if result.returncode == 0 and result.stdout:
                return result.stdout.decode("utf-8", errors="ignore")
            logger.debug("Headless render failed (%d) for %s", result.returncode, url)
        except (subprocess.TimeoutExpired, OSError) as exc:
            logger.debug("Headless render error for %s: %s", url, exc)
        return None

    def _fetch(self, url: str):
        if self.browser_exe:
            dom = self._render_with_browser(url)
            if dom:
                return dom
            logger.debug("Falling back to plain HTTP for %s", url)
        try:
            resp = self.session.get(url, timeout=self.timeout, allow_redirects=True)
            if resp.status_code == 200 and "text/html" in resp.headers.get("Content-Type", ""):
                return resp.text
        except requests.RequestException as exc:
            logger.debug("Fetch failed %s: %s", url, exc)
        return None

    @staticmethod
    def _extract_title(page_html: str) -> str:
        match = re.search(r"<title[^>]*>(.*?)</title>", page_html, re.IGNORECASE | re.DOTALL)
        if not match:
            match = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\'](.*?)["\']',
                              page_html, re.IGNORECASE)
        if not match:
            return ""
        return html.unescape(match.group(1)).strip()

    @staticmethod
    def _extract_links(page_html: str, page_url: str):
        for href in re.findall(r'<a[^>]+href=["\']([^"\']+)["\']', page_html, re.IGNORECASE):
            url = urljoin(page_url, href.split("#")[0].strip()).rstrip("/")
            if url.startswith("http") and not url.lower().startswith(("mailto:", "tel:", "javascript:")):
                yield url

    @staticmethod
    def html_to_text(page_html: str) -> str:
        """Extract visible text from HTML without external parser libraries."""
        text = re.sub(r"<!--.*?-->", " ", page_html, flags=re.DOTALL)
        text = re.sub(r"<!--.*?-->", " ", text, flags=re.DOTALL)
        # Drop boilerplate containers: nav/header carry the mega-menu on every
        # page and would flood every RAG chunk with the same menu text.
        text = re.sub(
            r"<(script|style|noscript|svg|iframe|template|nav|header|aside|form)[^>]*>.*?</\1>",
            " ", text, flags=re.IGNORECASE | re.DOTALL)
        # form controls / images: keep alt text, drop the rest
        text = re.sub(r'<img[^>]+alt=["\']([^"\']*)["\'][^>]*>', r" \1 ", text, flags=re.IGNORECASE)
        text = re.sub(r"<(input|button|select|option|textarea)[^>]*>.*?(</\1>|$)", " ",
                      text, flags=re.IGNORECASE | re.DOTALL)
        # headings and block tags become line breaks so chunks stay structured
        text = re.sub(r"<(h[1-6]|p|li|tr|div|section|article|br)[^>]*>", "\n", text,
                      flags=re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        text = html.unescape(text)
        lines = []
        for line in text.splitlines():
            line = re.sub(r"\s+", " ", line).strip()
            if not line or len(line) < 3:
                continue
            if any(re.match(p, line, re.IGNORECASE) for p in NOISE_PATTERNS):
                continue
            lines.append(line)
        # drop consecutive duplicates (repeated nav text)
        deduped = []
        for line in lines:
            if not deduped or deduped[-1] != line:
                deduped.append(line)
        return "\n".join(deduped)

    def crawl(self):
        """Breadth-first crawl of the site. Yields dicts: url, title, text."""
        visited = set()
        queue = deque([self.base_url])

        # Prefer sitemap URLs if present: better coverage, fewer requests
        sitemap_url = urljoin(self.base_url, "/sitemap.xml")
        try:
            resp = self.session.get(sitemap_url, timeout=self.timeout)
            if resp.status_code == 200 and "<loc>" in resp.text:
                locs = re.findall(r"<loc>(.*?)</loc>", resp.text)
                html_locs = [u.strip() for u in locs if _is_html_url(u.strip())]
                if html_locs:
                    logger.info("Sitemap found with %d URLs", len(html_locs))
                    queue = deque(html_locs[: self.max_pages])
        except requests.RequestException:
            logger.info("No sitemap.xml, falling back to link crawl")

        count = 0
        while queue and count < self.max_pages:
            url = queue.popleft().rstrip("/")
            if url in visited or not self._allowed(url):
                continue
            visited.add(url)

            page_html = self._fetch(url)
            time.sleep(self.delay)
            if not page_html:
                continue

            title = self._extract_title(page_html)
            body_text = self.html_to_text(page_html)
            if len(body_text) < 200:
                logger.debug("Skipping thin page %s (%d chars)", url, len(body_text))
                continue

            count += 1
            logger.info("[%d/%d] %s -> %s (%d chars)", count, self.max_pages,
                        url, title or "(untitled)", len(body_text))
            yield {"url": url, "title": title, "text": body_text}

            for link in self._extract_links(page_html, url):
                if link not in visited:
                    queue.append(link)


def crawl_website(base_url: str, max_pages: int = 150, delay: float = 0.5,
                  render_js: bool = True):
    """Convenience wrapper: run a crawl and return a list of page records."""
    crawler = WebsiteCrawler(base_url, max_pages=max_pages, delay=delay,
                             render_js=render_js)
    return list(crawler.crawl())


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.leewaysoftech.com"
    pages = crawl_website(url)
    print(f"\nCrawled {len(pages)} pages from {url}")
    for page in pages:
        print(f"- {page['url']} :: {page['title']} ({len(page['text'])} chars)")
