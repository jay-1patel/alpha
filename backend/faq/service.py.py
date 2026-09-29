import os
import re
import json
import logging
import sqlite3
import threading
import subprocess
from functools import lru_cache

import httpx
import numpy as np
import requests
from sentence_transformers import SentenceTransformer, CrossEncoder
from rank_bm25 import BM25Okapi
import faiss

from routing.config import (
    DB_PATH, EMBEDDING_MODEL_PATH, BRAND_NAME, SUPPORT_EMAIL, SUPPORT_PHONE,
    BRAND_WEBSITE, OLLAMA_API_URL, OLLAMA_MODEL, OLLAMA_BASE_URL,
    BRAND_TAGLINE, SIGNATURE,
    GROQ_API_URL, GROQ_API_KEY, GROQ_MODEL,
    MISTRAL_API_URL, MISTRAL_API_KEY, MISTRAL_MODEL,
)
from database import save_embeddings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("faq_bot")

# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────
EMBEDDING_MODEL     = EMBEDDING_MODEL_PATH
CROSS_ENCODER_MODEL = os.path.join(os.path.dirname(__file__), "..", "models", "ettin-reranker-68m-v1")

_model_cfg_path = os.path.join(EMBEDDING_MODEL, "config.json")
if os.path.exists(_model_cfg_path):
    with open(_model_cfg_path) as _f:
        EMBEDDING_DIM = json.load(_f).get("hidden_size", 1024)
else:
    EMBEDDING_DIM = 1024

SIMILARITY_THRESHOLD        = 0.30
CE_SCORE_THRESHOLD          = 0.00
HIGH_CONFIDENCE_THRESHOLD   = 0.60
MEDIUM_CONFIDENCE_THRESHOLD = 0.25

# Minimum acceptable answer length from the LLM. Ollama's JSON mode sometimes
# stops after just an intro line; short answers / list-intros trigger a retry.
MIN_ANSWER_CHARS             = 120


def _answer_looks_truncated(answer: str) -> bool:
    """True when the LLM produced only a stub instead of a real answer.

    Heuristics: empty/very short, or ends with a colon (an intro line that
    points to a list/bullets which were never generated, e.g. "…here are the
    options available:").
    """
    s = (answer or "").strip()
    if not s:
        return True
    if len(s) < MIN_ANSWER_CHARS:
        return True
    return s.endswith(":")


def _build_deterministic_fallback(context: str, max_items: int = 3) -> str:
    """Builds a bulleted answer directly from the retrieved Q/A context.

    Last-resort path when the LLM keeps returning only an intro stub (e.g.
    qwen3's JSON grammar truncation). Renders the most relevant matched
    Q/A facts as scannable bullets with *bold* question lead-ins.
    """
    if not context:
        return ""
    chunks = re.split(r"\n\s*-{3,}\s*\n", context.strip())
    blocks: list[str] = []
    for chunk in chunks[:max_items]:
        chunk = re.sub(r"^\[relevance=[^\]]+\]\s*", "", chunk.strip())
        m = re.match(r"Q:\s*(.+?)\n+\s*A:\s*(.*)", chunk, re.DOTALL)
        if not m or not m.group(2).strip():
            continue
        bullets: list[str] = []
        for line in m.group(2).strip().splitlines():
            line = line.strip()
            if not line:
                continue
            bullets.append(line if line.startswith("- ") else f"- {line}")
        if not bullets:
            continue
        blocks.append(f"*{m.group(1).strip()}*")
        blocks.extend(bullets)
    joined = "\n".join(blocks).strip()
    return joined if joined else ""

SEMANTIC_CANDIDATE_K = 30
BM25_CANDIDATE_K     = 20
RERANK_TOP_K         = 20
RRF_K                = 60
RRF_WEIGHTS          = {"dense": 0.6, "sparse": 0.4}

# ─────────────────────────────────────────────
# Tokenizer
# ─────────────────────────────────────────────
_STOPWORDS = frozenset(
    "a an the is are was were be been being have has had do does did "
    "will would shall should may might can could of in to for on with "
    "at by from as into about between through during and but or nor "
    "not so yet both either neither each every all any few more most "
    "other some such no only own same than too very that this these "
    "those it its he she they them their what which who whom how when "
    "where why am does".split()
)


def simple_tokenize(text: str) -> list[str]:
    tokens = re.findall(r"\w+", text.lower())
    return [t for t in tokens if t not in _STOPWORDS and len(t) > 1]


# ─────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────
embedding_model = SentenceTransformer(EMBEDDING_MODEL)
cross_encoder   = CrossEncoder(CROSS_ENCODER_MODEL)


@lru_cache(maxsize=2048)
def _encode_query_cached(query: str) -> bytes:
    emb = embedding_model.encode([query], convert_to_numpy=True)
    emb = emb / (np.linalg.norm(emb, axis=1, keepdims=True) + 1e-10)
    return emb.astype(np.float32).tobytes()

# ─────────────────────────────────────────────
# Dynamic Button Generation
# ─────────────────────────────────────────────
# UPDATED: adapters for the new routing/button_actions.py API, which exposes:
#   BUTTONS: dict[str, str]              id -> display label
#   TOPIC_SUGGESTIONS: list[dict]        keyword groups with "actions"/"source"
#   get_suggestion_buttons(query, top_k) -> [{"id", "label"}]
# The rest of this file keeps working with {"id", "title"} via the helpers
# below, so no other logic needed to change.
# ─────────────────────────────────────────────
SHORT_TITLES: dict[str, str] = {
    # WhatsApp reply-button titles must be <= 20 chars. These override the
    # longer display labels in BUTTONS. (Alternatively, shorten the labels
    # in button_actions.py directly and delete this map.)
    "privacy_policy":       "🔒 Privacy Policy",   # 16
    "terms_conditions":     "📄 Terms & Cond.",    # 16
    "company_policy":       "🏢 Company Policies", # 18
    "contact_support":      "💬 Contact Support",  # 17
    "return_policy":        "↩️ Returns & Refund", # 18
    "track_order":          "📦 Track Order",      # 13
    "shipping_policy":      "🚚 Shipping Info",    # 16
    "order_policy":         "🧾 Orders & GST",     # 15
    "product_prices":       "💰 Product Prices",   # 16
    "new_arrival":          "✨ New Arrivals",     # 14
    "product_ingredients":  "🥜 Ingredients",      # 13
    "allergen_info":        "⚠️ Allergen Info",    # 15
    "shelf_life":           "📅 Shelf Life",       # 13
    "moq_policy":           "📊 MOQ & Bulk",       # 13
    "credit_period_policy": "💳 Credit Terms",     # 15
    "distributor_info":     "🤝 Distributorship",  # 16
}


def _short_title(action_id: str, default: str) -> str:
    """WhatsApp-safe (<=20 char) title for an action id."""
    return SHORT_TITLES.get(action_id, default or action_id)[:20]


def _registry_prompt_text() -> str:
    """Allowed-buttons list for the LLM prompt (id -> exact title to copy)."""
    from routing.button_actions import BUTTONS
    return "\n".join(
        f'- "{bid}" -> "{_short_title(bid, label)}"'
        for bid, label in BUTTONS.items()
    )


def _suggest_actions(query: str, source_file: str = "") -> list[dict]:
    """Topic-aware button suggestions as [{"id", "title"}].

    1. Keyword match via button_actions.get_suggestion_buttons().
    2. If no keyword hit (e.g. vague query like "tell me more"), fall back
       to the retrieved document's source_file matching a group's "source".
    """
    from routing.button_actions import (
        BUTTONS, TOPIC_SUGGESTIONS, get_suggestion_buttons,
    )

    results = get_suggestion_buttons(query, top_k=3)
    if results:
        return [
            {"id": s["id"], "title": _short_title(s["id"], s.get("label", ""))}
            for s in results
        ]

    if source_file:
        sf = source_file.lower()
        for group in TOPIC_SUGGESTIONS:
            for src in group.get("source", []) or []:
                if src and src.lower() in sf:
                    return [
                        {"id": a, "title": _short_title(a, BUTTONS.get(a, a))}
                        for a in group.get("actions", [])[:3]
                        if a in BUTTONS
                    ]
    return []


async def _generate_ollama_dynamic_response(
    system_prompt: str, user_query: str, context: str = "", source_file: str = ""
) -> dict:
    allowed_buttons = _registry_prompt_text()
    suggested = _suggest_actions(user_query, source_file=source_file)
    suggested_text = ", ".join(f'"{s["id"]}"' for s in suggested) if suggested else "none"

    json_prompt = f"""{system_prompt}

CRITICAL: You must respond ONLY in valid JSON format using this exact schema:
{{
  "answer": "Your text answer to the user goes here.",
  "next_actions": [
    {{"id": "action_id_from_registry", "title": "Button Title"}}
  ]
}}

Rules for next_actions:
- You MUST choose ids ONLY from this approved registry (id -> button title):
{allowed_buttons}

- Pick 2-3 actions that are the most relevant follow-ups for THIS answer's topic.
- Good starting candidates for this query: {suggested_text}
- Copy the button title EXACTLY as given in the registry for the chosen id.
- If no registry action is relevant, return an empty list for next_actions.
- Maximum 3 next_actions allowed. NEVER invent new ids or titles outside the registry.

Context to use for your answer:
{context[:10000] if context else "No additional context provided."}

Remember: You must output ONLY valid JSON. No markdown, no code blocks, no explanations outside the JSON structure."""

    providers = [
        ("ollama", OLLAMA_BASE_URL, OLLAMA_MODEL, "no-key-needed", "ollama"),
        ("groq", GROQ_API_URL, GROQ_MODEL, GROQ_API_KEY, "openai"),
        ("mistral", MISTRAL_API_URL, MISTRAL_MODEL, MISTRAL_API_KEY, "openai"),
    ]

    best: dict | None = None
    for name, url, model, api_key, api_type in providers:
        if not api_key:
            continue
        for attempt in (1, 2):
            try:
                raw_response = await _call_llm_provider(
                    name, url, model, api_key, api_type, json_prompt, user_query,
                    force_json=(attempt == 2),
                )
                parsed = _parse_faq_dynamic_json(raw_response, user_query)
                if parsed:
                    answer = parsed.get("answer", "") or ""
                    if attempt == 1 and _answer_looks_truncated(answer):
                        logger.warning(
                            f"FAQ_DYNAMIC_SHORT_ANSWER | provider={name} | "
                            f"answer_len={len(answer.strip())} | retrying with json grammar"
                        )
                        continue
                    if not _answer_looks_truncated(answer):
                        logger.info(f"FAQ_DYNAMIC_SUCCESS | provider={name} | actions={len(parsed.get('next_actions', []))}")
                        return parsed
                    best = parsed
                else:
                    logger.warning(
                        f"FAQ_DYNAMIC_PARSE_FAIL | provider={name} | raw[:300]={raw_response[:300]!r}"
                    )
            except Exception as e:
                logger.warning(f"FAQ_DYNAMIC_FALLBACK | provider={name} attempt={attempt} failed: {e}")
                break

    if best is not None:
        det = _build_deterministic_fallback(context)
        if det:
            best["answer"] = det
            logger.info("FAQ_DYNAMIC_DETERMINISTIC_FALLBACK | used context-derived bulleted answer")
            return best

    logger.warning("FAQ_DYNAMIC_ALL_FAILED | using keyword fallback")
    return _fallback_dynamic_buttons("", user_query)


async def _call_llm_provider(name, url, model, api_key, api_type, system_prompt, user_query, force_json: bool = True) -> str:
    logger.info(f"LLM_CALL | provider={name} | model={model} | url={url}")
    if api_type == "ollama":
        try:
            # SECURITY FIX: Use absolute paths and explicit shell=False
            nvidia_smi_path = "/usr/bin/nvidia-smi" if os.name != "nt" else "nvidia-smi"
            command = [
                nvidia_smi_path,
                "--query-gpu=utilization.gpu,memory.used,memory.total,name",
                "--format=csv,noheader,nounits"
            ]
            
            if os.name == "nt":
                si = subprocess.STARTUPINFO()
                si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                result = subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    timeout=5,
                    startupinfo=si,
                    shell=False  # SECURITY FIX: Explicitly disable shell
                )
            else:
                result = subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    timeout=5,
                    shell=False  # SECURITY FIX: Explicitly disable shell
                )
            if result.returncode == 0 and result.stdout.strip():
                for line in result.stdout.strip().splitlines():
                    parts = [p.strip() for p in line.split(",")]
                    if len(parts) == 4:
                        util, mem_used, mem_total, gpu_name = parts
                        logger.info(f"GPU_STATS | name={gpu_name} | util={util}% | mem={mem_used}/{mem_total}MB")
            else:
                logger.warning("GPU_STATS | nvidia-smi returned no GPU data")
        except FileNotFoundError:
            logger.warning("GPU_STATS | nvidia-smi not found — GPU logging unavailable")
        except Exception as e:
            logger.warning(f"GPU_STATS | failed: {e}")
    async with httpx.AsyncClient(timeout=30) as client:
        if api_type == "ollama":
            payload = {
                "model": model,
                "stream": False,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_query},
                ],
                "keep_alive": "30m",
                "think": False,
                "options": {
                    "num_ctx": 8192,
                    "num_predict": 4096,
                    "num_gpu": 99,
                    "num_thread": 8,
                    "num_batch": 1024,
                    "flash_attention": True,
                    "temperature": 0.2,
                    "top_p": 0.9,
                    "repeat_penalty": 1.0,
                    "seed": 42,
                },
            }
            if force_json:
                payload["format"] = "json"
            logger.info(
                f"LLM_CALL | provider={name} | model={model} | gpu={payload['options']['num_gpu']} | ctx={payload['options']['num_ctx']}"
            )
            response = await client.post(f"{url}/api/chat", json=payload, timeout=30)
            logger.info(f"LLM_RESPONSE | provider={name} | status={response.status_code}")
            response.raise_for_status()
            return response.json().get("message", {}).get("content", "").strip()
        else:
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_query},
                ],
                "temperature": 0.2,
                "max_tokens": 4096,
            }
            response = await client.post(url, json=payload, headers=headers, timeout=30)
            logger.info(f"LLM_RESPONSE | provider={name} | status={response.status_code}")
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()


def _parse_faq_dynamic_json(raw_response: str, user_query: str) -> dict | None:
    if not raw_response:
        return None

    # Strategy 1: raw load; Strategy 2: markdown fences stripped;
    # Strategy 3: substring from first '{' to last '}'
    cleaned = re.sub(r"```(?:json)?", "", raw_response).strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    candidates = [raw_response.strip(), cleaned]
    if start != -1 and end > start:
        candidates.append(cleaned[start:end + 1])

    for cand in candidates:
        try:
            parsed = json.loads(cand)
            if isinstance(parsed, dict) and "answer" in parsed:
                return _validate_faq_dynamic_result(parsed)
        except (json.JSONDecodeError, TypeError):
            continue

    # Strategy 4: legacy regex extraction
    patterns = [
        r"```(?:json)?\s*\n?(\{.*?\})\s*```?",
        r'\{[^{}]*"answer"[^{}]*"next_actions"[^{}]*\[[^\]]*\][^{}]*\}',
        r"\{.*?\}",
    ]
    for pat in patterns:
        match = re.search(pat, raw_response, re.DOTALL)
        if match:
            try:
                json_str = match.group(1) if match.groups() else match.group(0)
                parsed = json.loads(json_str)
                if isinstance(parsed, dict) and "answer" in parsed:
                    return _validate_faq_dynamic_result(parsed)
            except (json.JSONDecodeError, KeyError, TypeError):
                continue

    return None


def _validate_faq_dynamic_result(parsed: dict) -> dict:
    answer = parsed.get("answer", "")
    next_actions = parsed.get("next_actions", [])
    if not isinstance(next_actions, list):
        next_actions = []

    # Only keep actions that exist in the registry — invented buttons are dropped.
    # UPDATED: BUTTONS is now id -> label string (not id -> {"title": ...}).
    try:
        from routing.button_actions import BUTTONS
    except Exception:
        BUTTONS = {}

    validated = []
    for action in next_actions:
        if isinstance(action, dict):
            aid = (action.get("id", "") or "").strip()
            label = BUTTONS.get(aid)
            if not label:
                continue
            # Prefer the registry title (canonical, <= 20 chars).
            validated.append({"id": aid[:50], "title": _short_title(aid, label)})

    return {"answer": answer[:10000], "next_actions": validated[:3]}


def _fallback_dynamic_buttons(raw_text: str, user_query: str, source_file: str = "") -> dict:
    if not raw_text:
        raw_text = "I'm having trouble generating a response. Please try again or contact our support team."

    # Topic-aware suggestions from the shared registry (guaranteed-implemented actions).
    # UPDATED: uses the local _suggest_actions adapter (new button_actions API).
    try:
        next_actions = _suggest_actions(user_query, source_file=source_file)
    except Exception as exc:
        logger.warning(f"Registry suggestion failed, using no buttons: {exc}")
        next_actions = []

    return {"answer": raw_text[:4000], "next_actions": next_actions[:3]}


def _is_bulleted_line(line: str) -> bool:
    """True when a line already looks like a bullet / list item."""
    s = line.strip()
    if not s:
        return False
    if s.startswith(("- ", "* ", "• ", "– ", "— ")):
        return True
    return bool(re.match(r"^\d+[.)]\s", s))


def _format_faq_answer(answer: str) -> str:
    """Deterministic formatting pass: break long paragraph blocks into short
    WhatsApp bullet points so answers stay scannable even when the LLM ignores
    the formatting prompt (common on legal/policy chunks, especially the raw
    low-confidence fallback path).

    Existing bullets, short one-line openers, *bold* markers, numbers/prices,
    and the signature block are all preserved.
    """
    if not answer or not answer.strip():
        return answer or ""

    # Isolate the signature block so we never reformat it.
    parts = re.split(r"(\n---)", answer, maxsplit=1)
    if len(parts) == 3:
        body, sep, suffix = parts
        suffix = sep + suffix
    else:
        body, suffix = answer, ""

    out = []
    for raw in body.split("\n"):
        s = raw.strip()
        if not s:
            out.append(raw)
            continue

        # Strip "Q:" / "A:" prefixes from raw document dumps.
        qa = re.match(r"^[QA]:\s+(.+)$", s)
        if qa:
            s = qa.group(1).strip()

        if _is_bulleted_line(s):
            out.append(s)
            continue

        # Long paragraph line -> break into bullet points.
        if len(s) >= 150:
            sentences = [p.strip() for p in re.split(
                r"(?<=[.!?])\s+(?=[A-Z0-9*₹€$])", s) if p.strip()]
            if len(sentences) > 1:
                out.append(sentences[0])
                for extra in sentences[1:]:
                    extra = re.sub(r"^[-•*\s]+", "", extra).strip()
                    if extra:
                        out.append(f"- {extra}")
                continue

        out.append(s)

    return "\n".join(out).rstrip() + suffix


# ─────────────────────────────────────────────
# FAQ Index
# ─────────────────────────────────────────────
class FAQIndex:
    """
    Hybrid retrieval:
      1. Dense  – FAISS IndexFlatIP (cosine via L2-normed embeddings)
      2. Sparse – BM25Okapi with stopword-filtered tokenization
      3. Fusion – Weighted Reciprocal Rank Fusion (RRF)
      4. Re-rank – CrossEncoder with CE score threshold
    """

    def __init__(self):
        self.chunks: list[str]    = []
        self.metadata: list[dict] = []
        self.embeddings: np.ndarray | None = None
        self.index: faiss.Index | None     = None
        self.bm25:  BM25Okapi | None       = None
        self.tokenized_corpus: list[list[str]] = []
        self.is_built = False
        self._lock = threading.Lock()

    # ── build ─────────────────────────────────
    def build(self, force: bool = False):
        with self._lock:
            if self.is_built and not force:
                return
            try:
                conn = sqlite3.connect(DB_PATH)
                conn.row_factory = sqlite3.Row
                rows = conn.execute("SELECT * FROM faq_dataset").fetchall()
                conn.close()
            except Exception as exc:
                logger.error(f"Failed to load chunks: {exc}")
                return

            if not rows:
                logger.warning("No chunks in database")
                return

            chunks, metadatas, all_embeddings, missing = [], [], [], []

            for row in rows:
                chunks.append(row["content"])
                metadatas.append({
                    "source":       "document",
                    "id":           row["id"],
                    "source_file":  row["source_file"],
                    "content_type": row["content_type"],
                    "page_number":  row["page_number"],
                    "media_url":    row["media_url"]  if "media_url"  in row.keys() else None,
                    "media_type":   row["media_type"] if "media_type" in row.keys() else None,
                })

                if row["embedding"]:
                    all_embeddings.append(
                        np.frombuffer(row["embedding"], dtype=np.float32)
                    )
                else:
                    missing.append((len(chunks) - 1, row["id"], row["content"]))

            # Compute missing embeddings
            if missing:
                to_encode = [m[2] for m in missing]
                computed  = embedding_model.encode(to_encode, convert_to_numpy=True)
                computed  = self._normalize(computed).astype(np.float32)

                save_data = []
                for i, (chunk_idx, chunk_id, _) in enumerate(missing):
                    all_embeddings.insert(chunk_idx, computed[i])
                    save_data.append((chunk_id, computed[i].tobytes()))

                save_embeddings(save_data)
                logger.info(f"Computed and saved {len(save_data)} new embeddings")

            # Build FAISS index (dense)
            emb_matrix = np.array(all_embeddings, dtype=np.float32)
            self.index = faiss.IndexFlatIP(EMBEDDING_DIM)
            self.index.add(emb_matrix)

            # Build BM25 index (sparse) with improved tokenization
            tokenized = [simple_tokenize(c) for c in chunks]
            self.bm25             = BM25Okapi(tokenized)
            self.tokenized_corpus = tokenized

            self.chunks   = chunks
            self.metadata = metadatas
            self.embeddings = emb_matrix
            self.is_built = True
            logger.info(f"FAQ index built: {len(chunks)} vectors (dense + sparse)")

    # ── helpers ───────────────────────────────
    @staticmethod
    def _normalize(vecs: np.ndarray) -> np.ndarray:
        return vecs / (np.linalg.norm(vecs, axis=1, keepdims=True) + 1e-10)

    def _dense_search(self, query: str, k: int) -> list[tuple[int, float]]:
        """Return (chunk_index, cosine_score) pairs."""
        q_emb = np.frombuffer(_encode_query_cached(query), dtype=np.float32).reshape(1, -1)
        distances, indices = self.index.search(q_emb, k)
        return [
            (int(idx), float(dist))
            for idx, dist in zip(indices[0], distances[0])
            if idx != -1
        ]

    def _sparse_search(self, query: str, k: int) -> list[tuple[int, float]]:
        """Return (chunk_index, bm25_score) pairs with filtered tokenization."""
        tokens = simple_tokenize(query)
        scores = self.bm25.get_scores(tokens)
        top_k  = np.argsort(scores)[::-1][:k]
        return [(int(i), float(scores[i])) for i in top_k if scores[i] > 0]

    @staticmethod
    def _reciprocal_rank_fusion(
        *ranked_lists: list[tuple[int, float]],
        weights: list[float] | None = None,
        k: int = RRF_K,
    ) -> list[tuple[int, float]]:
        if weights is None:
            weights = [1.0] * len(ranked_lists)

        rrf_scores: dict[int, float] = {}
        for weight, ranked in zip(weights, ranked_lists):
            for rank, (idx, _) in enumerate(ranked, start=1):
                rrf_scores[idx] = rrf_scores.get(idx, 0.0) + weight / (k + rank)

        return sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

    def _rerank(
        self,
        query: str,
        candidates: list[tuple[int, float]],
        top_k: int,
    ) -> list[tuple[str, dict, float]]:
        if not candidates:
            return []

        texts = [self.chunks[idx] for idx, _ in candidates]
        pairs = [[query, t] for t in texts]
        scores = cross_encoder.predict(pairs)

        ranked = sorted(
            zip(candidates, scores),
            key=lambda x: x[1],
            reverse=True,
        )[:top_k]

        return [
            (self.chunks[idx], self.metadata[idx], float(ce_score))
            for (idx, _), ce_score in ranked
            if ce_score >= CE_SCORE_THRESHOLD
        ]

    # ── public search ─────────────────────────
    def search(
        self,
        query: str,
        k: int = RERANK_TOP_K,
    ) -> list[tuple[str, dict, float]]:
        if not self.is_built:
            return []

        # Step 1 — candidate retrieval
        dense_results  = self._dense_search(query, SEMANTIC_CANDIDATE_K)
        sparse_results = self._sparse_search(query, BM25_CANDIDATE_K)

        # Step 2 — weighted RRF fusion
        fused = self._reciprocal_rank_fusion(
            dense_results, sparse_results,
            weights=[RRF_WEIGHTS["dense"], RRF_WEIGHTS["sparse"]],
        )

        # Step 3 — hard threshold on dense score
        dense_scores = {idx: score for idx, score in dense_results}
        pre_filter_count = len(fused)
        fused = [
            (idx, rrf_score)
            for idx, rrf_score in fused
            if dense_scores.get(idx, 0.0) >= SIMILARITY_THRESHOLD
        ]

        logger.info(
            f"Search query: '{query}' | "
            f"Fused candidates: {pre_filter_count} → after threshold: {len(fused)} | "
            f"Dense top scores: {[round(s, 4) for _, s in dense_results[:5]]}"
        )

        if not fused and dense_results:
            logger.warning(
                f"All candidates rejected by threshold ({SIMILARITY_THRESHOLD}) for: '{query}' | "
                f"Closest rejected: {[(self.chunks[idx][:100], round(score, 4)) for idx, score in dense_results[:5]]}"
            )

        # Step 4 — cross-encoder re-rank with CE score threshold
        return self._rerank(query, fused, top_k=k)


# ─────────────────────────────────────────────
faq_index = FAQIndex()

SYSTEM_PROMPT = f"""
You are a friendly, helpful assistant for {BRAND_NAME}, {BRAND_TAGLINE}.
Your job is to answer the user's question using ONLY the information provided in the context.

IMPORTANT ANSWERING RULES:
- Read ALL provided context before answering.
- Include the facts that RELEVANT to the user's actual question. Skip unrelated facts even if present in the context.
- Do NOT omit key numbers, names, dates, prices, conditions, limits, or contact details the user asked about.
- If the context contains a RANGE, always state the complete range.
- Never invent, assume, or calculate information that is not supported by the context.
- If the context does not contain enough information, say so in one honest sentence.

RESPONSE STYLE — write like a top-tier consumer brand's WhatsApp chat (think Zomato/Dunzo tone: warm, playful, human):
1. FIRST LINE: direct answer, friendly and confident. Address the user's actual question.
2. THEN: write the details as CLEAN BULLET POINTS (- ) or numbered lists — one fact per bullet along with *bold*. NEVER dump the full answer into one long unbroken paragraph; if you have several facts, break them into bullets. For policy, legal, GST, or detailed topics, include ALL the relevant information from the context without cutting corners.
3. CLOSER: end with ONE engaging line that invites the next action — vary it naturally, e.g.:
   - "Anything else I can help with? 😊"
   - "Shall I help you with anything else — orders, products, or policies?"
   - "Tap below to explore more 👇"
4. For simple questions: 100-150 words. For detailed topics (policies, GST, legal, shipping rules, terms and conditions,privacy policy,company policy etc.): as many words as needed to be thorough — do NOT cut important details short.Use bullet points along with *bold*.
5. Simple everyday words a school student understands. Replace jargon:
   - "revise its policies" -> "update its policies"
   - "exclusive jurisdiction" -> "courts in Delhi handle disputes"
 6. Use *bold* for key facts (prices, dates, deadlines, product names).
 7. ALWAYS use bullet points (- ) or numbered lists for your answer body. Structure every answer as short, scannable lines — even 2-sentence answers should be easy to scan. If you catch yourself writing a long unbroken paragraph, break it into bullets immediately.
 8. Add 1-2 relevant emojis per message, placed naturally (not every line).
 9. Never use Q: A: format. Never say "based on the context".Never say for more information visit our website.
 10. Never use markdown tables (# headers, | tables, code blocks). Always present information as clean lists, bullet points, or readable text layout with *bold*.
 11. If info is missing, be honest in one line and pivot: "I don't have that detail yet, but our team can help — want me to connect you?"
 12. Mirror the user's tone lightly: casual question -> casual answer; formal -> formal.

SPECIAL DOCUMENT RULE:
- If GST,any policy, catalogue, product, pricing, shipping, returns, or similar structured information is requested, include ALL relevant information available in the provided context .use bullet points along with *bold*.
- Never include links or URLs unless they are explicitly present and required by the context.
- Never tell the customer to visit the website when the required information is already available in the provided context.

HUMAN SUPPORT:
If the user seems frustrated, confused, asks for human help, OR the question is too specific/sensitive, OR it involves orders/delays, refunds/replacements, complaints/quality, billing/payment, distributor/partnership, or anything you cannot answer, include:

🙋 Need further assistance? Our support team is happy to help!
• 📧 Email us at: {SUPPORT_EMAIL}
• 📞 Call us at: {SUPPORT_PHONE}
We're available to assist you and will get back to you as soon as possible!

IMPORTANT:
Answer the user's actual question directly.
Do not provide unrelated information.
Do not leave out relevant information simply because the answer would become longer.
"""

STRICT_SYSTEM_PROMPT = f"""
You are a friendly, helpful assistant for {BRAND_NAME}, {BRAND_TAGLINE}.

The retrieved context is a PARTIAL match to the user's question.

Your job is to extract and combine ALL relevant information from the provided context that can help answer the question.

IMPORTANT:
- Read ALL provided context carefully.
- Include every relevant fact the user asked about.
- Do NOT answer using only the first or most obvious matching sentence.
- Keep key numbers, dates, prices, and conditions the user asked about.
- If several relevant pieces of information are present, combine them briefly.
- If the context contains a RANGE, always state the full range.
- Never invent information that is not present in the context.
- If the context is insufficient, say so clearly rather than guessing.

RESPONSE STYLE — same engaging WhatsApp tone (Zomato/Dunzo style):
1. FIRST LINE: direct answer.
2. THEN: write the details as CLEAN BULLET POINTS (- ) or numbered lists — one fact per bullet along with *bold*. NEVER dump the full answer into one long unbroken paragraph; if you have several facts, break them into bullets. For policy, legal, GST, or detailed topics, include ALL the relevant information from the context without cutting corners.
3. CLOSER: one inviting line ("Want more details? Tap below 👇" or "Anything else? 😊").
4. For simple questions: 100-150 words. For detailed topics: as many words as needed to be thorough — do NOT cut important details short.Use bullet points along with *bold*.
5. Never use Q: A: format. Never say "based on the context".Never say "for more info visit our website".
6. ALWAYS use bullet points (- ) or numbered lists for your answer body. Structure every answer as short, scannable lines — even 2-sentence answers should be easy to scan. If you catch yourself writing a long unbroken paragraph, break it into bullets immediately.
7. Use *bold* for key facts (prices, dates, deadlines, product names).
8. Add 1-2 relevant emojis per message, placed naturally.
9. Never use markdown tables (# headers, | tables, code blocks). Always present information as clean lists, bullet points, or readable text layout.Use *bold* for important words.
10. If context is only partially relevant, answer what you can and offer help:
    "I'm not 100% sure about that one — want me to connect you with our team? 🙋"

If GST,any policy, catalogue, product, pricing, shipping, returns, or similar structured information is requested, include ALL relevant information available in the provided context use bullet points along with WhatsApp formatting: *bold*.Never show long paragraph break it in bullet points.

HUMAN SUPPORT:
If the user seems frustrated, confused, asks for human help, OR the question is too specific/sensitive, OR it involves orders/delays, refunds/replacements, complaints/quality, billing/payment, distributor/partnership, or anything you cannot answer, include:

🙋 Need further assistance? Our support team is happy to help!
• 📧 Email us at: {SUPPORT_EMAIL}
• 📞 Call us at: {SUPPORT_PHONE}
We're available to help and will get back to you as soon as possible!
"""

# ─────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────
def build_index() -> dict:
    faq_index.build(force=True)
    return {
        "status": "ok",
        "vectors": faq_index.index.ntotal if faq_index.is_built else 0,
    }


async def handle_faq_query(payload: dict) -> dict:
    message = payload.get("message", "").strip()

    if not message:
        return {"answer": _append_signature("Please provide a question.")}

    if not faq_index.is_built:
        logger.warning("FAQ index not built on query — attempting on-demand build")
        try:
            faq_index.build()
        except Exception as exc:
            logger.error(f"On-demand FAQ index build failed: {exc}")

    if not faq_index.is_built:
        logger.warning("FAQ index still not built — returning fallback with buttons")
        fallback = _fallback_dynamic_buttons(
            "I'm still learning. Please try again shortly or contact our support team.", message
        )
        result = {"answer": _append_signature(fallback.get("answer", ""))}
        next_actions = fallback.get("next_actions", [])
        if next_actions:
            buttons = [
                {"type": "reply", "reply": {"id": a["id"][:256], "title": a["title"][:20]}}
                for a in next_actions if a.get("id") and a.get("title")
            ]
            if buttons:
                result["interactive"] = {"type": "button", "buttons": buttons}
        return result

    # ── Retrieve & re-rank ────────────────────
    results = faq_index.search(message, k=RERANK_TOP_K)

    if not results:
        logger.warning(
            f"Dissimilar question (no FAQ match): '{message}' | "
            f"Query returned 0 results after similarity threshold ({SIMILARITY_THRESHOLD})"
        )
        return {"answer": _append_signature("")}

    logger.info(f"Top 20 QA matches for user question: '{message}'")
    for rank, (chunk_text, metadata, score) in enumerate(results, start=1):
        logger.info(
            f"  Match #{rank} | Score: {score:.3f} | "
            f"Source: {metadata.get('source_file', 'N/A')} | "
            f"Content: {chunk_text[:200]}"
        )

    best_ce_score = results[0][2]

    # ── Build context (filter by CE score) ────
    context_parts = []

    for chunk_text, metadata, score in results:
        if score < CE_SCORE_THRESHOLD:
            continue
        context_parts.append(f"[relevance={score:.3f}]\n{chunk_text}")
        # Feed at most the top 8 matches to the LLM: feeding all 20 candidate
        # chunks makes the prompt huge and causes Ollama to truncate its
        # answer (it runs out of generation room inside the fixed ctx window).
        if len(context_parts) >= 8:
            break

    # Fallback: use best result even if below threshold
    if not context_parts:
        best_text, best_meta, best_score = results[0]
        context_parts = [f"[relevance={best_score:.3f}]\n{best_text}"]

    # Media: only from the top result
    best_meta = results[0][1]
    media_url  = best_meta.get("media_url")  or None
    media_type = best_meta.get("media_type") or None

    context = "\n\n---\n\n".join(context_parts)

    if media_url:
        media_label = "document" if media_type == "document" else "image"
        context += (
            f"\n\n[An attached {media_label} accompanies this reply and is sent "
            f"separately to the customer. Do NOT include its file link or any URL "
            f"in your text, and do NOT tell the customer to view products, "
            f"lineups, or images on the website — the attached {media_label} "
            f"already shows them.]"
        )

    # ── Two-tier: pick system prompt by confidence ──
    if best_ce_score >= HIGH_CONFIDENCE_THRESHOLD:
        system_prompt = SYSTEM_PROMPT
        logger.info(f"High confidence ({best_ce_score:.3f}) for: '{message}'")
    elif best_ce_score >= MEDIUM_CONFIDENCE_THRESHOLD:
        system_prompt = STRICT_SYSTEM_PROMPT
        logger.info(f"Medium confidence ({best_ce_score:.3f}) for: '{message}' — strict prompt")
    else:
        logger.info(f"Low confidence ({best_ce_score:.3f}) for: '{message}' — using raw chunk with keyword buttons")
        best_chunk = results[0][0]
        fallback = _fallback_dynamic_buttons(best_chunk, message, source_file=best_meta.get("source_file", "") or "")
        result = {"answer": _append_signature(_format_faq_answer(fallback.get("answer", best_chunk)))}
        if media_url:
            result["media_url"]  = media_url
            result["media_type"] = media_type
        next_actions = fallback.get("next_actions", [])
        if next_actions:
            buttons = [
                {"type": "reply", "reply": {"id": a["id"][:256], "title": a["title"][:20]}}
                for a in next_actions
                if a.get("id") and a.get("title")
            ]
            if buttons:
                result["interactive"] = {"type": "button", "buttons": buttons}
        return result

    # ── Call Ollama LLM (with dynamic buttons) ──
    try:
        response = await _generate_ollama_dynamic_response(
            system_prompt, message, context,
            source_file=best_meta.get("source_file", "") or "",
        )

        answer = response.get("answer", "")
        next_actions = response.get("next_actions", [])

        result = {"answer": _append_signature(_format_faq_answer(answer))}
        if media_url:
            result["media_url"]  = media_url
            result["media_type"] = media_type

        if next_actions:
            buttons = [
                {"type": "reply", "reply": {"id": a["id"][:256], "title": a["title"][:20]}}
                for a in next_actions
                if a.get("id") and a.get("title")
            ]
            if buttons:
                result["interactive"] = {"type": "button", "buttons": buttons}
        return result

    except Exception as exc:
        logger.error(f"Dynamic button generation error: {exc}", exc_info=True)
        best_chunk, best_meta_fb, _ = results[0]
        fallback = _fallback_dynamic_buttons(best_chunk, message, source_file=best_meta_fb.get("source_file", "") or "")
        result = {"answer": _append_signature(fallback.get("answer", best_chunk))}
        if media_url:
            result["media_url"]  = media_url
            result["media_type"] = media_type
        next_actions = fallback.get("next_actions", [])
        if next_actions:
            buttons = [
                {"type": "reply", "reply": {"id": a["id"][:256], "title": a["title"][:20]}}
                for a in next_actions
                if a.get("id") and a.get("title")
            ]
            if buttons:
                result["interactive"] = {"type": "button", "buttons": buttons}
        return result


def _append_signature(text: str) -> str:
    if not SIGNATURE:
        return text or ""
    text = text or ""
    if SIGNATURE in text:
        return text
    return text.rstrip() + f"\n\n--- 🌿 {SIGNATURE}"
