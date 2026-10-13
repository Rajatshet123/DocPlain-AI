
import { useRef, useState, useEffect } from "react";
import "./App.css";

const API_BASE = "https://docplain-ai.onrender.com";

const initialMessages = [
  {
    role: "assistant",
    content:
      "Welcome to DocPlain AI! Upload a PDF and ask questions about its contents. I'll help you understand complex documents in simple language.",
  },
];

function App() {
  const [file, setFile] = useState(null);
  const [documentId, setDocumentId] = useState(null);
  const [pageCount, setPageCount] = useState(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleFile(selectedFile) {
    if (!selectedFile) return;

    if (
      selectedFile.type !== "application/pdf" &&
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please select a PDF file.");
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setError("This PDF exceeds the 15 MB upload limit. Please choose a smaller PDF.");
      return;
    }

    setFile(selectedFile);
    setDocumentId(null);
    setPageCount(null);
    setError("");
    setUploading(true);
    setMessages([
      {
        role: "assistant",
        content: `Uploading "${selectedFile.name}" and preparing it for questions. Please wait.`,
      },
    ]);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${API_BASE}/upload-pdf`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "PDF upload failed.");
      }

      setDocumentId(data.document_id);
      setPageCount(data.page_count);

      setMessages([
        {
          role: "assistant",
          content: `Your PDF "${data.filename}" is ready! I indexed ${data.page_count} page(s). Ask me a question about the document.`,
        },
      ]);
    } catch (err) {
      setDocumentId(null);
      setError(
        err.message ||
          "Unable to connect to the backend. Check that the FastAPI server is running."
      );

      setMessages([
        {
          role: "assistant",
          content:
            "I couldn't prepare that PDF. Check the error message above, then try again.",
        },
      ]);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) handleFile(droppedFile);
  }

  async function sendQuestion(event) {
    event.preventDefault();

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || loading || uploading) return;

    if (!documentId) {
      setError("Upload a PDF successfully before asking a question.");
      return;
    }

    setError("");
    setQuestion("");
    setMessages((previous) => [
      ...previous,
      { role: "user", content: trimmedQuestion },
    ]);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          document_id: documentId,
          question: trimmedQuestion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to answer your question.");
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: data.answer || "No answer was returned.",
          sources: data.sources || [],
        },
      ]);
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to the backend. Check your server and try again."
      );
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "I couldn't answer that question. Please check the error message and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function resetChat() {
    setFile(null);
    setDocumentId(null);
    setPageCount(null);
    setQuestion("");
    setError("");
    setUploading(false);
    setLoading(false);
    setMessages(initialMessages);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeFile() {
    setFile(null);
    setDocumentId(null);
    setPageCount(null);
    setError("");
    setMessages(initialMessages);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="DocPlain AI home">
          <div className="brand-icon">D</div>
          <div>
            <span className="brand-name">DocPlain</span>
            <span className="brand-suffix">AI</span>
            <p className="brand-caption">Understand every document</p>
          </div>
        </a>

        <button className="new-chat-button" onClick={resetChat}>
          <span>＋</span> New conversation
        </button>

        <div className="sidebar-section">
          <p className="section-label">WORKSPACE</p>
          <div className="nav-item active">
            <span className="nav-icon">▤</span>
            Document assistant
          </div>
          <div className="nav-item">
            <span className="nav-icon">◷</span>
            Conversation history
            <span className="soon-tag">Soon</span>
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="privacy-card">
            <span className="privacy-icon">✳</span>
            <div>
              <strong>Your documents, your answers.</strong>
              <p>Built for document-grounded understanding.</p>
            </div>
          </div>
          <div className="sidebar-footer">
            <span className="status-dot" />
            DocPlain AI · Development
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <strong>Document assistant</strong>
          </div>
          <div className="topbar-right">
            <span className="model-indicator">
              <span className="model-dot" />
              Gemini connected
            </span>
            <div className="avatar">R</div>
          </div>
        </header>

        <div className="workspace">
          <section className="welcome-section">
            <div className="eyebrow">
              <span className="sparkle">✳</span>
              YOUR AI DOCUMENT COMPANION
            </div>
            <h1>
              Make sense of <span>every page.</span>
            </h1>
            <p className="welcome-description">
              Upload a document, ask questions in plain English, and get
              answers grounded in your source material.
            </p>
          </section>

          <section className="upload-card">
            <div className="upload-heading">
              <div>
                <h2>Your document</h2>
                <p>Start by adding a PDF to your workspace.</p>
              </div>
              {documentId && (
                <span className="file-ready">PDF ready · {pageCount} pages</span>
              )}
            </div>

            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />

            {!file ? (
              <div
                className="drop-zone"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Choose or drop a PDF file"
              >
                <div className="upload-icon">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15.5v3A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-3"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <strong>
                  Drop your PDF here, or <span>browse files</span>
                </strong>
                <p>PDF documents only · Maximum size 15 MB</p>
              </div>
            ) : (
              <div className="selected-file">
                <div className="pdf-icon">PDF</div>
                <div className="file-details">
                  <strong title={file.name}>{file.name}</strong>
                  <span>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                    {uploading
                      ? " · Uploading and indexing..."
                      : documentId
                        ? " · Uploaded and indexed"
                        : " · Upload failed"}
                  </span>
                </div>
                <button
                  className="remove-file"
                  onClick={removeFile}
                  aria-label="Remove selected PDF"
                  disabled={uploading || loading}
                >
                  ×
                </button>
              </div>
            )}

            {uploading && (
              <p role="status" className="upload-note">
                Preparing your PDF for questions. The first upload may take
                longer while the embedding model loads.
              </p>
            )}

            {error && (
              <p role="alert" className="upload-note">
                ⚠ {error}
              </p>
            )}

            <div className="upload-note">
              <span>ⓘ</span>
              <span>
                Your PDF is processed by the local backend and indexed for
                document-grounded answers.
              </span>
            </div>
          </section>

          <section className="chat-card">
            <div className="chat-header">
              <div className="chat-heading-icon">✳</div>
              <div className="chat-title">
                <h2>Ask your document</h2>
                <p>Explore ideas, find details, and clarify concepts.</p>
              </div>
              <span className="chat-mode">Document Q&amp;A</span>
            </div>

            <div className="messages-area">
              {messages.map((message, index) => (
                <div
                  className={`message-row ${message.role}`}
                  key={`${message.role}-${index}`}
                >
                  <div className={`message-avatar ${message.role}`}>
                    {message.role === "assistant" ? "✳" : "R"}
                  </div>
                  <div className="message-body">
                    <span className="message-author">
                      {message.role === "assistant" ? "DocPlain AI" : "You"}
                    </span>
                    <div className="message-bubble">{message.content}</div>

                    {message.sources?.length > 0 && (
                      <div className="message-sources">
                        <strong>Sources</strong>
                        {message.sources.map((source, sourceIndex) => (
                          <div
                            className="source-item"
                            key={`${source.page}-${sourceIndex}`}
                          >
                            <strong>PDF page {source.page}</strong>
                            <p>{source.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {(loading || uploading) && (
                <div className="typing-indicator" role="status">
                  <span />
                  <span />
                  <span />
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <form className="chat-input-area" onSubmit={sendQuestion}>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendQuestion(event);
                  }
                }}
                placeholder={
                  documentId
                    ? "Ask anything about your document..."
                    : "Upload a PDF to start asking questions..."
                }
                rows={2}
                aria-label="Your question"
                disabled={!documentId || uploading || loading}
              />
              <div className="input-bottom">
                <span className="input-hint">
                  Enter to send · Shift + Enter for a new line
                </span>
                <button
                  className="send-button"
                  type="submit"
                  disabled={
                    !question.trim() ||
                    !documentId ||
                    uploading ||
                    loading
                  }
                  aria-label="Send question"
                >
                  <span>{loading ? "Thinking..." : "Send"}</span>
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </form>

            <p className="chat-disclaimer">
              AI-generated answers use relevant passages retrieved from your
              uploaded document. Always verify important details against the
              original PDF.
            </p>
          </section>

          <footer className="page-footer">
            <span>DocPlain AI</span>
            <span>From complex pages to clear answers.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
