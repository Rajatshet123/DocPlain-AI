
import os
import tempfile
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from pdf_processor import extract_pdf_pages
from rag_engine import chunk_pages, build_search_index
from qa_engine import answer_question

load_dotenv()

app = FastAPI(
    title="DocPlain AI",
    description="An AI-powered PDF document assistant",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://doc-plain-ai.vercel.app/",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Temporary in-memory storage for uploaded documents.
# Documents are cleared when the backend restarts.
documents = {}


class AskRequest(BaseModel):
    document_id: str
    question: str


@app.get("/")
def home():
    return {
        "message": "Welcome to DocPlain AI",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF file.",
        )

    temp_path = None

    try:
        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="The uploaded PDF is empty.",
            )

        if len(content) > 15 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="PDF size must be 15 MB or less.",
            )

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".pdf",
        ) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        pages = extract_pdf_pages(temp_path)

        if not pages:
            raise HTTPException(
                status_code=422,
                detail="No readable text found in this PDF.",
            )

        chunks = chunk_pages(pages)

        if not chunks:
            raise HTTPException(
                status_code=422,
                detail="Could not create searchable text from this PDF.",
            )

        index, chunks = build_search_index(chunks)

        if index is None:
            raise HTTPException(
                status_code=422,
                detail="Could not build the document search index.",
            )

        document_id = str(uuid.uuid4())

        documents[document_id] = {
            "filename": file.filename,
            "page_count": len(pages),
            "index": index,
            "chunks": chunks,
        }

        return {
            "document_id": document_id,
            "filename": file.filename,
            "page_count": len(pages),
            "message": "PDF uploaded and indexed successfully.",
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Could not process this PDF: {str(exc)}",
        ) from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
        await file.close()


@app.post("/ask")
def ask_question(request: AskRequest):
    document = documents.get(request.document_id)

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Document not found. Please upload the PDF again.",
        )

    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Please enter a question.",
        )

    try:
        result = answer_question(
            question=request.question,
            index=document["index"],
            chunks=document["chunks"],
        )

        return {
            "document_id": request.document_id,
            "filename": document["filename"],
            "question": request.question,
            "answer": result["answer"],
            "sources": result["sources"],
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not answer the question: {str(exc)}",
        ) from exc
