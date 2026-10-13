
from pypdf import PdfReader


def extract_pdf_pages(file_path: str) -> list[dict]:
    """Extract readable text from each PDF page."""
    reader = PdfReader(file_path)
    pages = []

    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""

        if text.strip():
            pages.append({
                "page": page_number,
                "text": text.strip()
            })

    return pages
