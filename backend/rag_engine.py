
import os

import faiss
import numpy as np
from dotenv import load_dotenv
from google import genai

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY is missing.")

client = genai.Client(api_key=API_KEY)
EMBEDDING_MODEL = "gemini-embedding-001"


def embed_texts(texts: list[str]) -> np.ndarray:
    """Create normalized embeddings using Gemini, in small batches."""
    all_embeddings = []

    for start in range(0, len(texts), 16):
        batch = texts[start:start + 16]

        response = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=batch,
        )

        all_embeddings.extend(
            embedding.values for embedding in response.embeddings
        )

    embeddings = np.asarray(all_embeddings, dtype="float32")
    faiss.normalize_L2(embeddings)

    return embeddings


def chunk_pages(
    pages: list[dict],
    chunk_size: int = 1000,
    overlap: int = 150,
) -> list[dict]:
    """Split extracted PDF pages into overlapping text chunks."""
    chunks = []

    if chunk_size <= overlap:
        raise ValueError("chunk_size must be greater than overlap")

    for page in pages:
        text = page["text"]
        start = 0

        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunk_text = text[start:end].strip()

            if chunk_text:
                chunks.append({
                    "page": page["page"],
                    "text": chunk_text,
                })

            if end == len(text):
                break

            start = end - overlap

    return chunks


def build_search_index(
    chunks: list[dict],
) -> tuple[faiss.IndexFlatIP | None, list[dict]]:
    """Build a FAISS index using Gemini text embeddings."""
    if not chunks:
        return None, []

    texts = [chunk["text"] for chunk in chunks]
    embeddings = embed_texts(texts)

    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)

    return index, chunks


def search_chunks(
    question: str,
    index,
    chunks: list[dict],
    top_k: int = 4,
) -> list[dict]:
    """Retrieve the most relevant document chunks."""
    if not question.strip() or index is None or not chunks:
        return []

    query_embedding = embed_texts([question])

    k = min(top_k, len(chunks))
    scores, indices = index.search(query_embedding, k)

    results = []

    for score, idx in zip(scores[0], indices[0]):
        if idx >= 0:
            results.append({
                **chunks[int(idx)],
                "score": float(score),
            })

    return results
