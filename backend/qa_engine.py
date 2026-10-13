
import os

from dotenv import load_dotenv
from google import genai

from rag_engine import search_chunks

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = "gemini-3.5-flash-lite"

if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY is missing from the backend .env file.")

client = genai.Client(api_key=API_KEY)


def answer_question(
    question: str,
    index,
    chunks: list[dict],
) -> dict:
    """Answer a question using retrieved PDF passages and page citations."""

    if not question.strip():
        raise ValueError("Please enter a question.")

    retrieved = search_chunks(question, index, chunks, top_k=4)

    if not retrieved:
        return {
            "answer": "I couldn't find relevant readable text in the uploaded document.",
            "sources": [],
        }

    context_parts = []
    sources = []

    for item in retrieved:
        page_number = item["page"]
        context_parts.append(
            f"[Source: PDF page {page_number}]\n{item['text']}"
        )

        source = {
            "page": page_number,
            "text": item["text"],
        }

        if source not in sources:
            sources.append(source)

    context = "\n\n".join(context_parts)

    prompt = f"""
You are DocPlain AI, a careful PDF document assistant.

Answer the user's question using only the supplied document passages.
Explain complex ideas in clear, accessible language.
If the passages do not contain enough information, say so explicitly.
Do not invent facts or page numbers.
Cite supporting pages using the format [Page N].

DOCUMENT PASSAGES:
{context}

USER QUESTION:
{question}
"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )

    answer = response.text or "The AI returned an empty response."

    return {
        "answer": answer,
        "sources": sources,
    }
