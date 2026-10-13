
import faiss
from sentence_transformers import SentenceTransformer


# Downloaded on first use; cached for later runs.
_embedding_model = None


def get_embedding_model():
    global _embedding_model

    if _embedding_model is None:
        _embedding_model = SentenceTransformer(
            "sentence-transformers/all-MiniLM-L6-v2"
        )

    return _embedding_model


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
    """Build a FAISS index using normalized text embeddings."""
    if not chunks:
        return None, []

    model = get_embedding_model()
    texts = [chunk["text"] for chunk in chunks]

    embeddings = model.encode(
        texts,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=False,
    )

    embeddings = embeddings.astype("float32")

    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)

    return index, chunks


def search_chunks(
    question: str,
    index,
    chunks: list[dict],
    top_k: int = 4,
) -> list[dict]:
    """Retrieve the most relevant text chunks for a question."""
    if not question.strip() or index is None or not chunks:
        return []

    model = get_embedding_model()

    query_embedding = model.encode(
        [question],
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=False,
    ).astype("float32")

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
