import json
import logging
import sqlite3
import hashlib
import threading
import time
from typing import List, Dict, Tuple
import numpy as np
import faiss

from routing.config import DB_PATH, EMBEDDING_MODEL_PATH

logger = logging.getLogger("leeway_webhook")

EMBEDDING_MODEL = EMBEDDING_MODEL_PATH
EMBEDDING_DIM = 1024

try:
    import sys
    if "faq.service" in sys.modules:
        embedding_model = sys.modules["faq.service"].embedding_model
    else:
        from faq.service import embedding_model
except Exception:
    from sentence_transformers import SentenceTransformer
    embedding_model = SentenceTransformer(EMBEDDING_MODEL)


def _drop_cached_embeddings():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("DROP TABLE IF EXISTS cached_embeddings")
        conn.commit()
        conn.close()
        logger.info("Dropped cached_embeddings table")
    except Exception as e:
        logger.error(f"Failed to drop cached_embeddings: {e}")


class InMemoryKB:
    def __init__(self):
        self.chunks: List[str] = []
        self.metadata: List[Dict] = []
        self.index: faiss.IndexFlatIP = None
        self.embeddings: np.ndarray = None
        self.is_built = False

    def build_index(self, chunks: List[str], metadatas: List[Dict]) -> None:
        if not chunks or len(chunks) != len(metadatas):
            return

        self.chunks = chunks
        self.metadata = metadatas

        embeddings = embedding_model.encode(chunks, convert_to_numpy=True)
        embeddings = embeddings / (np.linalg.norm(embeddings, axis=1, keepdims=True) + 1e-10)

        self.index = faiss.IndexFlatIP(EMBEDDING_DIM)
        self.index.add(embeddings.astype(np.float32))
        self.embeddings = embeddings.astype(np.float32)
        self.is_built = True
        logger.info(f"FAISS index built: {len(chunks)} vectors")

    def search(self, query: str, k: int = 5) -> List[Tuple[str, Dict, float]]:
        if not self.is_built or self.index is None:
            return []

        query_embedding = embedding_model.encode([query], convert_to_numpy=True)
        query_embedding = query_embedding / (np.linalg.norm(query_embedding, axis=1, keepdims=True) + 1e-10)

        distances, indices = self.index.search(query_embedding.astype(np.float32), k)

        results = []
        for idx, distance in zip(indices[0], distances[0]):
            if idx != -1:
                results.append((self.chunks[idx], self.metadata[idx], float(distance)))

        return results

    def search_filtered(self, query: str, source: str, k: int = 5) -> List[Tuple[str, Dict, float]]:
        if not self.is_built or self.index is None:
            return []

        query_embedding = embedding_model.encode([query], convert_to_numpy=True)
        query_embedding = query_embedding / (np.linalg.norm(query_embedding, axis=1, keepdims=True) + 1e-10)

        distances, indices = self.index.search(query_embedding.astype(np.float32), min(k * 5, self.index.ntotal))

        results = []
        for idx, distance in zip(indices[0], distances[0]):
            if idx != -1 and self.metadata[idx].get("source") == source:
                results.append((self.chunks[idx], self.metadata[idx], float(distance)))
            if len(results) >= k:
                break

        return results

    def count(self) -> int:
        if self.index is None:
            return 0
        return self.index.ntotal


kb_store = InMemoryKB()


def load_faqs_from_db() -> List[Dict]:
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM faq_dataset").fetchall()
        conn.close()
        return [
            {
                "id": row["id"],
                "category": row["source_file"],
                "content": row["content"],
                "content_type": row["content_type"],
                "module": row["module"],
            }
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Failed to load FAQs: {e}")
        return []


def build_index_from_db():
    _drop_cached_embeddings()

    all_chunks = []
    all_metadata = []

    faqs = load_faqs_from_db()
    for faq in faqs:
        chunk = faq["content"]
        all_chunks.append(chunk)
        all_metadata.append({
            "source": faq.get("module", "faq"),
            "id": faq["id"],
            "category": faq.get("category", ""),
            "content_type": faq.get("content_type", ""),
        })

    if all_chunks:
        kb_store.build_index(all_chunks, all_metadata)
        logger.info(f"Index built: {len(all_chunks)} FAQs")
    else:
        kb_store.chunks = []
        kb_store.metadata = []
        kb_store.index = None
        kb_store.embeddings = None
        kb_store.is_built = False
        logger.info("No data to index")

    start_sync_thread()


def get_stats() -> Dict:
    return {
        "is_built": kb_store.is_built,
        "total_vectors": kb_store.count(),
    }


# ---------------------------------------------------------------------------
# Background sync: monitor DB for changes, rebuild in-memory index on change
# ---------------------------------------------------------------------------
_faq_snapshot: Dict[int, str] = {}


def _row_hash(*cols) -> str:
    return hashlib.md5(json.dumps(list(cols), ensure_ascii=False).encode()).hexdigest()


def _get_faq_snapshot() -> Dict[int, str]:
    try:
        conn = sqlite3.connect(DB_PATH)
        rows = conn.execute("SELECT id, source_file, content, content_type, module FROM faq_dataset").fetchall()
        conn.close()
        return {r[0]: _row_hash(r[1], r[2], r[3], r[4]) for r in rows}
    except Exception:
        return {}


def start_sync_thread(interval=5):
    global _sync_thread_started, _faq_snapshot
    if _sync_thread_started:
        return
    _sync_thread_started = True

    _faq_snapshot = _get_faq_snapshot()

    def _syncer():
        while True:
            time.sleep(interval)
            try:
                faq_snap = _get_faq_snapshot()
                if faq_snap != _faq_snapshot:
                    logger.info("Change detected in DB, rebuilding in-memory index...")
                    _faq_snapshot = faq_snap
                    all_chunks = []
                    all_metadata = []

                    faqs = load_faqs_from_db()
                    for faq in faqs:
                        all_chunks.append(faq["content"])
                        all_metadata.append({
                            "source": faq.get("module", "faq"), "id": faq["id"], "category": faq.get("category", ""),
                            "content_type": faq.get("content_type", ""),
                        })

                    if all_chunks:
                        kb_store.build_index(all_chunks, all_metadata)
                        logger.info(f"Rebuilt index: {len(all_chunks)} vectors")
                    else:
                        kb_store.chunks = []
                        kb_store.metadata = []
                        kb_store.index = None
                        kb_store.embeddings = None
                        kb_store.is_built = False
            except Exception as e:
                logger.error(f"Sync thread error: {e}")

    t = threading.Thread(target=_syncer, daemon=True)
    t.start()
    logger.info("Background DB sync thread started (interval=%ds)" % interval)
