"""
RAG (Retrieval-Augmented Generation) knowledge base for Belair Direct.

Parses all scraped JSON documents from /scraped/, builds an in-memory FAISS
index at startup, and exposes a single search() function that returns the top 10
relevant results per query.

Result format:
  - Every result has: text, url, source
  - FAQ results additionally carry: faq_question, faq_answer

Embedding model: BAAI/bge-small-en-v1.5 (FastEmbed, ~90 MB, CPU)
Vector store:    FAISS (in-memory)
"""
import json
import re
import threading
from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
from langchain_core.documents import Document

_SCRAPED_DIR = Path(__file__).parent.parent.parent / "scraped"

# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_json(text: str) -> list:
    """Pull the first ```json … ``` block out of a markdown file."""
    m = re.search(r"```json\s*([\s\S]+?)```", text)
    if not m:
        return []
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return []


def _bd_links(raw: list[dict]) -> list[dict]:
    """Keep only belairdirect.com URLs from a links list."""
    return [l for l in raw if "belairdirect.com" in l.get("url", "")]


# ── Document parsers ──────────────────────────────────────────────────────────

def _load_faq(path: Path) -> list[Document]:
    docs = []
    for item in _extract_json(path.read_text(encoding="utf-8")):
        question = item.get("Question", "")
        answer   = item.get("Answer", "")
        # Embed: full question + first 400 chars of answer for relevance
        text = f"{question}\n{answer[:400]}"

        faq_url = "https://www.belairdirect.com/en/faq.html"
        # Collect any extra belairdirect links mentioned inside the answer
        extra_links = _bd_links(item.get("links", []))

        # Primary link carries the Q&A payload so search() can surface it
        primary = {
            "text": f"FAQ: {question[:80]}",
            "url": faq_url,
            "faq_question": question,
            "faq_answer": answer,
        }
        links = [primary] + extra_links

        docs.append(Document(
            page_content=text,
            metadata={
                "source": "FAQ",
                "title": question,
                "links": links,
            },
        ))
    return docs


def _load_blog(path: Path) -> list[Document]:
    docs = []
    for item in _extract_json(path.read_text(encoding="utf-8")):
        title    = item.get("blog_title", "")
        contents = item.get("blog_content", "")   # updated field name
        blog_url = item.get("blog_url", "")
        # Embed: title + first 400 chars of content
        text = f"{title}\n{contents[:400]}"

        # Blog's own URL is always the primary link
        links: list[dict] = []
        if blog_url:
            links.append({"text": title, "url": blog_url})

        # Add up to 3 extra belairdirect cross-links from within the post
        for l in _bd_links(item.get("links_included", [])):
            if l["url"] != blog_url:
                links.append({"text": l.get("text", l["url"]), "url": l["url"]})
            if len(links) >= 4:
                break

        if not links:
            links = [{"text": "belairdirect Blog", "url": "https://www.belairdirect.com/blog/"}]

        docs.append(Document(
            page_content=text,
            metadata={
                "source": "Blog",
                "title": title,
                "links": links,
            },
        ))
    return docs


def _load_prevention(path: Path) -> list[Document]:
    docs = []
    for item in _extract_json(path.read_text(encoding="utf-8")):
        title   = item.get("Title", "")
        content = item.get("content", "")
        text    = f"{title}\n{content[:400]}"

        links = item.get("links", [])
        if not links:
            links = [{"text": "Prevention Hub", "url": "https://www.belairdirect.com/en/prevention-hub.html"}]

        docs.append(Document(
            page_content=text,
            metadata={
                "source": "Prevention Hub",
                "title": title,
                "links": links,
            },
        ))
    return docs


def _load_tooltips(path: Path) -> list[Document]:
    """
    Load tool_tips.md — form field tooltip explanations.
    Each entry is indexed so that questions about form fields surface the
    right explanation. Uses the FAQ page as the canonical link.
    """
    docs = []
    for item in _extract_json(path.read_text(encoding="utf-8")):
        question    = item.get("Question", "")
        information = item.get("information", "")
        text = f"{question}\n{information[:400]}"

        docs.append(Document(
            page_content=text,
            metadata={
                "source": "Tooltip",
                "title": question,
                "links": [
                    {
                        "text": f"About: {question}",
                        "url": "https://www.belairdirect.com/en/faq.html",
                    }
                ],
                # Store full info so it can be surfaced directly
                "tooltip_question": question,
                "tooltip_info": information,
            },
        ))
    return docs


# ── Index builder ─────────────────────────────────────────────────────────────

_INDEX: FAISS | None = None
_DOCS:  list[Document] = []
_lock   = threading.Lock()
_ready  = False


def _build_index() -> None:
    """Build the FAISS index in a background thread so app startup is instant."""
    global _INDEX, _DOCS, _ready

    if not _SCRAPED_DIR.exists():
        return

    docs: list[Document] = []

    faq_path      = _SCRAPED_DIR / "FAQ_updated.md"
    blog_path     = _SCRAPED_DIR / "blog_updated.md"
    prev_path     = _SCRAPED_DIR / "prevention_hub_updated.md"
    tooltip_path  = _SCRAPED_DIR / "tool_tips.md"

    if faq_path.exists():
        docs.extend(_load_faq(faq_path))
    if blog_path.exists():
        docs.extend(_load_blog(blog_path))
    if prev_path.exists():
        docs.extend(_load_prevention(prev_path))
    if tooltip_path.exists():
        docs.extend(_load_tooltips(tooltip_path))

    if not docs:
        return

    print(f"[RAG] Building FAISS index from {len(docs)} documents…", flush=True)
    embeddings = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")
    index = FAISS.from_documents(docs, embeddings)

    with _lock:
        _INDEX = index
        _DOCS  = docs
        _ready = True

    print(f"[RAG] Index ready ({len(docs)} docs).", flush=True)


# Start building in background — app becomes healthy immediately while index loads
threading.Thread(target=_build_index, daemon=True).start()


# ── Public API ────────────────────────────────────────────────────────────────

def search(query: str, k: int = 10) -> list[dict]:
    """
    Semantic search over all scraped documents.

    Returns up to 10 deduplicated result dicts. Each dict always has:
        text   — display label
        url    — resource URL
        source — "FAQ" | "Blog" | "Prevention Hub" | "Tooltip"

    FAQ results additionally carry:
        faq_question — the exact FAQ question
        faq_answer   — the full FAQ answer

    Tooltip results additionally carry:
        tooltip_question — the form field label
        tooltip_info     — the tooltip explanation text
    """
    with _lock:
        index = _INDEX

    if index is None:
        return []

    # Fetch more candidates than needed to allow deduplication
    results = index.similarity_search(query, k=k * 2)

    seen_urls: set[str] = set()
    links: list[dict] = []

    for doc in results:
        source = doc.metadata.get("source", "")
        for link in doc.metadata.get("links", []):
            url = link.get("url", "").strip()
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)

            entry: dict = {
                "text":   link.get("text", url),
                "url":    url,
                "source": source,
            }

            # Attach FAQ Q&A if present on the link dict
            if "faq_question" in link:
                entry["faq_question"] = link["faq_question"]
                entry["faq_answer"]   = link["faq_answer"]

            # Attach tooltip info if present in doc metadata
            if source == "Tooltip":
                entry["tooltip_question"] = doc.metadata.get("tooltip_question", "")
                entry["tooltip_info"]     = doc.metadata.get("tooltip_info", "")

            links.append(entry)

        if len(links) >= k:
            break

    return links[:k]
