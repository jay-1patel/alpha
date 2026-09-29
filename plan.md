# Leeway Softech AI Chatbot — Migration & Build Plan

**Project:** Leeway Softech website chatbot (WhatsApp + Admin panel)
**Goal:** One AI chatbot that answers ALL Leeway Softech questions using content taken from our own website — running 100% on local models, no third-party LLM.
**Date prepared:** 2026-09-29
**Intern tracker:** [docs/INTERN_TASK_SHEET.md](docs/INTERN_TASK_SHEET.md) (maintained daily)

---

## 1. What we have today

The codebase is a working WhatsApp chatbot (previously branded for another client, partially rebranded):

| Layer | Current implementation | Local? |
|---|---|---|
| Webhook / routing | `routing/webhook.py`, `backend/main.py` (FastAPI, port 9000) | Yes |
| KB bot (RAG) | `kb/` — FAISS + chunking + menus + tools | Yes |
| FAQ bot | `backend/faq/service.py` — hybrid retrieval + generation | Yes |
| Embeddings | Local BGE-M3 (`backend/models/bge-m3`, sentence-transformers) | Yes |
| LLM | Ollama **or** Groq/Mistral cloud (selector in `kb/services/brain.py` + `backend/faq/service.py`) | Mixed |
| Data | `faq.db` SQLite — `faq_dataset`, `knowledge_base`, `products` tables | Yes |

Problems to fix:

1. **Wrong data source** — the KB is seeded with the old client's product catalogue; it knows nothing about Leeway Softech (services, portfolio, bulk SMS/email, SEO, contact info, careers...).
2. **Cloud LLM fallback** — if Ollama is down, the bot silently falls back to Groq/Mistral (paid, data leaves the machine).
3. **Stale branding** — `routing/.env` still has `BRAND_NAME=TrooGood`, `BRAND_WEBSITE=www.troogood.com`. Also note the official brand is **"Leeway Softech"** (one "t"), while most code strings say "Leeway Softtech" — pick one spelling and apply it everywhere.

---

## 2. Target architecture (no third-party LLM)

```
WhatsApp user
    │
    ▼
send2.digital webhook → backend/main.py (FastAPI :9000)
    │
    ▼
Routing / classifier (keyword + menu FSM, local)
    │
    ├─► FAQ bot  ─── hybrid retrieval (BM25 + FAISS/BGE-M3) ──┐
    ├─► KB bot   ─── RAG over knowledge_base (FAISS/BGE-M3) ──┤
    │                                                          ▼
    │                                        Ollama (localhost:11434, qwen3:8b)
    │                                                          │
    ▼                                                          ▼
send2.digital send API ◄──────────── grounded answer + source URL

Knowledge refresh loop (offline, on demand):
    leewaysoftech.com ──► kb/website_crawler.py ──► kb/ingest_website.py
                          (requests + regex)        (knowledge_base table,
                                                    embeddings, FAISS rebuild)
```

Nothing in the answering path touches an external LLM API. The only outbound
calls are: send2.digital (WhatsApp delivery) and the website crawl (content we own).

---

## 3. What was changed already (this session)

| File | Change |
|---|---|
| `kb/website_crawler.py` | **NEW** — same-domain crawler (robots.txt-aware, sitemap-aware, 0.5s delay, HTML→text with no extra dependencies) |
| `kb/ingest_website.py` | **NEW** — CLI: crawl → `knowledge_base` table via `add_document_to_kb()` → rebuild FAISS. `--dry-run`, `--refresh` (idempotent re-crawl), source recorded as `website:<url>` |
| `routing/config.py` | **NEW** settings: `STRICT_LOCAL_LLM`, `WEBSITE_CRAWL_URL/MAX_PAGES/DELAY` |
| `kb/services/brain.py` | `STRICT_LOCAL_LLM=1` → forces Ollama, never falls back to Mistral/Groq (raises a clear error instead) |
| `backend/faq/service.py` | `STRICT_LOCAL_LLM=1` → cloud providers removed from the generation provider list |
| `routing/.env.example` | Defaults: `API_PROVIDER=ollama`, `STRICT_LOCAL_LLM=1`, `BRAND_NAME=Leeway Softech`, `BRAND_WEBSITE`, website-crawl section |
| `routing/.env` (live, gitignored) | Fixed stale DB path `C:\keya\2608\FAQ.DB` (directory did not exist) → project DB `C:\Users\Leeway\Desktop\chatbot2\faq.db`; `BRAND_NAME=Leeway Softech`; `BRAND_WEBSITE=https://www.leewaysoftech.com`; `STRICT_LOCAL_LLM=1` added |

---

## 4. What we still need to change / do

### Phase A — Config & branding (Day 1–2)

- [ ] `routing/.env` (live file, gitignored — do by hand, never commit):
  - [x] `BRAND_NAME=Leeway Softech`, `BRAND_WEBSITE=https://www.leewaysoftech.com` (done 2026-09-29)
  - [x] `API_PROVIDER=ollama`, `STRICT_LOCAL_LLM=1` (done 2026-09-29)
  - [x] `ROUTING_DB_PATH` fixed to project `faq.db` (old path pointed to a non-existent folder)
  - [ ] **Delete** `GROQ_API_KEY`, `MISTRAL_API_KEY`, `MISTRAL_API_BACKUP` lines (safe now — `STRICT_LOCAL_LLM=1` already blocks them in code, but remove for defense in depth)
  - [ ] `WELCOME_MESSAGE`, `MENU_HEADER`, `SUPPORT_EMAIL`, `SUPPORT_PHONE` → Leeway Softech values
- [ ] Fix brand spelling: decide "Leeway Softech" and re-run a sweep
  (there are still "Leeway Softtech" strings in `classifier.py`, `message.py`,
  `kb_handler.py`, `menu_service.py`, admin panel, catalogue filename).
- [ ] `backend/models/bge-m3` must exist locally (else pip downloads it once — acceptable, it's a model file, not an API).

### Phase B — Website knowledge ingestion (Day 2–4)

- [ ] `pip install -r requirements.txt` (requests already included).
- [ ] Dry run: `python kb/ingest_website.py --dry-run` — review page list and text quality.
- [ ] Full ingest: `python kb/ingest_website.py` — pages land in `knowledge_base` (category `Website`), FAISS rebuilt.
- [x] **JS-rendered pages (resolved):** the site is a React SPA — every URL returns a 2.8 KB JS shell. The crawler now renders pages through headless Edge/Chrome (`--headless=old --dump-dom`), which ships with Windows, so no new dependency. Use `--no-render` only for plain-HTML sites. If a future Edge update drops `--headless=old`, switch to Playwright (`pip install playwright && playwright install chromium`).
- [ ] Write ~30 Leeway-specific FAQs (services, pricing policy, bulk SMS/email, WhatsApp API, SEO, support hours, contact) into `dataset/` and seed via the existing seed script — website crawl + curated FAQs together give the best answer quality.
- [ ] Add a cron/reminder: re-run `ingest_website.py --refresh` weekly so answers track site updates.

### Phase C — Local LLM hardening (Day 4–5)

- [ ] Install Ollama, `ollama pull qwen3:8b` (already configured as `OLLAMA_MODEL`).
- [ ] Verify: `curl http://localhost:11434/api/chat` responds; `ollama ps` shows the model.
- [ ] With `STRICT_LOCAL_LLM=1`, stop Ollama and send a test message → the bot must return a graceful "having trouble" message, NOT a cloud call. Grep logs for any `api.groq.com` / `api.mistral.ai` requests — there must be none.
- [ ] Audit remaining cloud paths: `backend/services/llm.py`, tools in `kb/services/tools.py`, complaint flows — confirm none call external LLM APIs (tracked as intern tasks).

### Phase D — Bot behaviour tuning (Day 5–8)

- [ ] Main menu: replace product-catalogue menu with Leeway services menu (Web Development, Mobile Apps, Bulk SMS/Email, WhatsApp Integration, SEO, Portfolio, Contact us, Talk to human).
- [ ] `kb/bot.config.json` — update categories/keywords for IT-services questions.
- [ ] Remove product-only tools from the tool registry (`search_products`, `get_nutrition_info`, `calculate_margin`...) or repurpose (`get_service_details`, `get_portfolio`).
- [ ] KB brain system prompt: enforce "answer only from context, always include source URL, if not on the website offer human handover".
- [ ] Human handover to Leeway support email/phone verified end-to-end.

### Phase E — Test & deploy (Day 8–10)

- [ ] Test matrix: greeting, menu navigation, service question (from website), off-topic question (must refuse + hand over), Hindi/Marathi messages, media message, complaint flow, Ollama-down behaviour.
- [ ] 50-question QA sheet: intern asks 50 real Leeway Softech questions, records bot answer + correct/incorrect, fixes KB gaps.
- [ ] Deploy: cloud VM or on-prem box with ≥16 GB RAM (Ollama 8B + BGE-M3 + FastAPI), Docker `docker compose up --build`, HTTPS via existing tunnel/domain setup.
- [ ] Point the send2.digital webhook at the production URL, verify incoming + outgoing.
- [ ] Enable monitoring/alert webhook; watch logs for a week.

---

## 5. Risks & decisions

| Risk / decision | Call |
|---|---|
| Website is a JavaScript SPA (React shell, no sitemap.xml) | Crawler renders pages via headless Edge (`--headless=old --dump-dom`); if a future Edge removes old-headless, switch to Playwright or PDF upload |
| Mega-menu text repeats on every page | Extractor drops `nav/header/aside/form` blocks; menu taxonomy still leaks into the first chunk of each page — tune chunking if retrieval gets noisy |
| Answer quality with a local 8B model | qwen3:8b is fine for grounded RAG answers; keep prompts tight and context small (top 5 chunks) |
| Old client's data in `faq.db` | Purge `products`, old `faq_dataset` rows and old `knowledge_base` rows before go-live (keep a backup copy of faq.db first) |
| Brand spelling "Softech" vs "Softtech" | Confirm with management; "Leeway Softech Pvt Ltd" per the official website + LinkedIn |
| Privacy | With STRICT_LOCAL_LLM=1 no customer message ever leaves the server except to WhatsApp (send2.digital) |
| Duplicate `kb/` copies (`kb/`, `backend/kb/` skeleton) | Only `kb/` is live; leave `backend/kb/` alone or delete in a cleanup task |

---

## 6. Commands cheat-sheet

```bash
# Local LLM
ollama serve
ollama pull qwen3:8b

# Ingest website into KB
python kb/ingest_website.py --dry-run          # preview
python kb/ingest_website.py                     # ingest + rebuild FAISS

# Run the bot (unified service, port 9000)
python run.py            # or: uvicorn backend.main:app --port 9000

# Standalone KB bot (port 9002)
python kb/main.py

# Confirm no cloud LLM in use
# grep -R "api.groq.com\|api.mistral.ai" logs/   -> should be empty
```

---

## 7. Acceptance criteria (definition of done)

1. Ask any Leeway Softech question covered by the website → bot answers correctly and cites the page URL.
2. Ask something NOT on the website → bot says it doesn't know and offers human handover; it never invents an answer.
3. Ollama stopped → no request leaves the machine; graceful fallback message.
4. `STRICT_LOCAL_LLM=1` set, cloud keys removed from `.env`.
5. Intern task sheet updated daily and signed off (docs/INTERN_TASK_SHEET.md).
