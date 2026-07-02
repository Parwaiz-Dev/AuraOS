"""Tests for RAG core modules — Milestone 7.

Covers:
- TextChunker: chunking, overlap, empty text
- CitationBuilder: build_citations, build_context_string, dedup, confidence threshold
- KnowledgeBase: add, get, list, delete, count, clear, multi-tenant
- DocumentLoader: TXT, MD, PDF detection, unsupported types, empty files
- ModelManager: _build_prompt, generate_answer, health_check, fallback
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.rag.chunker import Chunk, TextChunker
from app.rag.citation_builder import Citation, CitationBuilder
from app.rag.knowledge_base import DocumentRecord, KnowledgeBase, get_knowledge_base, reset_knowledge_base
from app.rag.document_loader import DocumentLoader, get_document_loader
from app.rag.model_manager import ModelManager, RAGAnswer, get_model_manager
from app.rag.retriever import RetrievalResult


# ═══════════════════════════════════════════════════════════════════════════════
# TextChunker
# ═══════════════════════════════════════════════════════════════════════════════


class TestTextChunker:
    """Unit tests for TextChunker."""

    def test_chunk_splits_text(self) -> None:
        """chunk() should split long text into overlapping chunks."""
        chunker = TextChunker(chunk_size=20, chunk_overlap=5)
        text = "word " * 50  # 50 words
        chunks = chunker.chunk(text=text, document_id="doc1")
        assert len(chunks) > 1
        assert all(isinstance(c, Chunk) for c in chunks)

    def test_chunk_ids_are_unique(self) -> None:
        """Each chunk should have a unique chunk_id."""
        chunker = TextChunker(chunk_size=10, chunk_overlap=2)
        text = "word " * 30
        chunks = chunker.chunk(text=text, document_id="doc1")
        ids = {c.chunk_id for c in chunks}
        assert len(ids) == len(chunks)

    def test_chunk_document_id_in_chunk_id(self) -> None:
        """chunk_id should contain the document_id."""
        chunker = TextChunker(chunk_size=10, chunk_overlap=2)
        chunks = chunker.chunk(text="hello world " * 10, document_id="doc123")
        for c in chunks:
            assert c.chunk_id.startswith("doc123_")

    def test_chunk_empty_text_returns_empty(self) -> None:
        """chunk() with empty text should return []."""
        chunker = TextChunker()
        chunks = chunker.chunk(text="", document_id="doc1")
        assert chunks == []

    def test_chunk_whitespace_only_returns_empty(self) -> None:
        """chunk() with whitespace-only text should return []."""
        chunker = TextChunker()
        chunks = chunker.chunk(text="   \n  \t  ", document_id="doc1")
        assert chunks == []

    def test_chunk_short_text_produces_one_chunk(self) -> None:
        """Short text should produce exactly one chunk."""
        chunker = TextChunker(chunk_size=500, chunk_overlap=50)
        chunks = chunker.chunk(text="Short text", document_id="doc1")
        assert len(chunks) == 1

    def test_chunk_token_count_correct(self) -> None:
        """Each chunk's token_count should match its text length in tokens."""
        chunker = TextChunker(chunk_size=10, chunk_overlap=0)
        chunks = chunker.chunk(text="a b c d e f g h i j k l m n o", document_id="d1")
        for c in chunks:
            assert c.token_count <= 10

    def test_chunk_metadata_passed_through(self) -> None:
        """Metadata should be attached to each chunk."""
        chunker = TextChunker()
        meta = {"document_type": "pdf", "filename": "test.pdf"}
        chunks = chunker.chunk(text="Hello world", document_id="d1", metadata=meta)
        for c in chunks:
            assert c.metadata == meta

    def test_chunk_index_sequential(self) -> None:
        """chunk_index should be sequential starting from 0."""
        chunker = TextChunker(chunk_size=5, chunk_overlap=0)
        chunks = chunker.chunk(text="word " * 20, document_id="d1")
        for i, c in enumerate(chunks):
            assert c.chunk_index == i

    def test_chunk_overlap(self) -> None:
        """With overlap, later chunks should share some tokens with earlier ones."""
        chunker = TextChunker(chunk_size=10, chunk_overlap=5)
        text = " ".join(f"token{i}" for i in range(30))
        chunks = chunker.chunk(text=text, document_id="d1")
        # At least one token from chunk 0 should appear in chunk 1
        if len(chunks) >= 2:
            tokens0 = set(chunks[0].text.split())
            tokens1 = set(chunks[1].text.split())
            assert len(tokens0 & tokens1) > 0

    def test_tokenize_splits_correctly(self) -> None:
        """_tokenize() should split on word boundaries."""
        tokens = TextChunker._tokenize("Hello, world! How are you?")
        assert "Hello" in tokens
        assert "world" in tokens
        assert "How" in tokens
        assert "are" in tokens
        assert "you" in tokens
        assert "," in tokens
        assert "!" in tokens
        assert "?" in tokens


# ═══════════════════════════════════════════════════════════════════════════════
# CitationBuilder
# ═══════════════════════════════════════════════════════════════════════════════


class TestCitationBuilder:
    """Unit tests for CitationBuilder."""

    def _make_result(
        self,
        doc_id: str = "d1",
        chunk_id: str = "c1",
        text: str = "Sample text",
        score: float = 0.85,
        doc_type: str = "txt",
    ) -> RetrievalResult:
        return RetrievalResult(
            chunk_id=chunk_id,
            document_id=doc_id,
            text=text,
            vector_score=score * 0.7,
            keyword_score=score * 0.3,
            combined_score=score,
            metadata={"document_type": doc_type},
        )

    def test_build_citations_empty_returns_empty(self) -> None:
        """build_citations() with empty results should return []."""
        builder = CitationBuilder()
        citations = builder.build_citations([])
        assert citations == []

    def test_build_citations_returns_citations(self) -> None:
        """build_citations() should return Citation objects."""
        builder = CitationBuilder()
        results = [self._make_result()]
        citations = builder.build_citations(results)
        assert len(citations) == 1
        assert isinstance(citations[0], Citation)
        assert citations[0].document_id == "d1"
        assert citations[0].document_type == "txt"

    def test_build_citations_below_threshold_skipped(self) -> None:
        """Results with combined_score < 0.1 should be skipped."""
        builder = CitationBuilder()
        results = [
            self._make_result(score=0.05),
            self._make_result(doc_id="d2", chunk_id="c2", score=0.85),
        ]
        citations = builder.build_citations(results)
        assert len(citations) == 1
        assert citations[0].document_id == "d2"

    def test_build_citations_deduplicates_by_document_id(self) -> None:
        """Only one citation per document_id."""
        builder = CitationBuilder()
        results = [
            self._make_result(doc_id="d1", chunk_id="c1", score=0.9),
            self._make_result(doc_id="d1", chunk_id="c2", score=0.8),
            self._make_result(doc_id="d2", chunk_id="c3", score=0.7),
        ]
        citations = builder.build_citations(results, max_citations=10)
        doc_ids = {c.document_id for c in citations}
        assert len(doc_ids) == 2
        # First occurrence of d1 should be kept
        assert citations[0].chunk_id == "c1"

    def test_build_citations_respects_max_citations(self) -> None:
        """Should return at most max_citations."""
        builder = CitationBuilder()
        results = [
            self._make_result(doc_id=f"d{i}", chunk_id=f"c{i}", score=0.9 - i * 0.1)
            for i in range(10)
        ]
        citations = builder.build_citations(results, max_citations=3)
        assert len(citations) == 3

    def test_build_citations_text_truncated(self) -> None:
        """Citation text should be truncated to 300 chars."""
        builder = CitationBuilder()
        long_text = "x" * 500
        results = [self._make_result(text=long_text)]
        citations = builder.build_citations(results)
        assert len(citations[0].text) <= 300

    def test_build_citations_confidence_in_range(self) -> None:
        """Confidence should be in [0, 1]."""
        builder = CitationBuilder()
        results = [self._make_result(score=0.75)]
        citations = builder.build_citations(results)
        assert 0.0 <= citations[0].confidence <= 1.0

    def test_build_context_string_empty(self) -> None:
        """build_context_string() with empty results returns placeholder."""
        builder = CitationBuilder()
        ctx = builder.build_context_string([])
        assert ctx == "No relevant documents found."

    def test_build_context_string_format(self) -> None:
        """build_context_string() should format with [Source: type] prefix."""
        builder = CitationBuilder()
        results = [
            self._make_result(doc_id="d1", text="Hello world", doc_type="txt"),
            self._make_result(doc_id="d2", text="Another doc", doc_type="pdf"),
        ]
        ctx = builder.build_context_string(results)
        assert "[Source: txt]" in ctx
        assert "[Source: pdf]" in ctx
        assert "Hello world" in ctx
        assert "---" in ctx

    def test_build_context_string_respects_max_chunks(self) -> None:
        """Should only include up to max_chunks results."""
        builder = CitationBuilder()
        results = [
            self._make_result(doc_id=f"d{i}", text=f"Text {i}") for i in range(10)
        ]
        ctx = builder.build_context_string(results, max_chunks=2)
        # Count [Source: occurrences
        assert ctx.count("[Source:") == 2


# ═══════════════════════════════════════════════════════════════════════════════
# KnowledgeBase
# ═══════════════════════════════════════════════════════════════════════════════


class TestKnowledgeBase:
    """Unit tests for KnowledgeBase."""

    @pytest.fixture(autouse=True)
    async def _reset_kb(self) -> None:
        """Reset the knowledge base before each test."""
        await reset_knowledge_base()

    def test_add_document_returns_record(self) -> None:
        """add_document() should return a DocumentRecord."""
        kb = KnowledgeBase()
        record = kb.add_document("r1", "test.txt", "txt", 5)
        assert isinstance(record, DocumentRecord)
        assert record.restaurant_id == "r1"
        assert record.filename == "test.txt"
        assert record.document_type == "txt"
        assert record.chunk_count == 5

    def test_add_document_generates_unique_id(self) -> None:
        """Each document should get a unique UUID."""
        kb = KnowledgeBase()
        r1 = kb.add_document("r1", "a.txt", "txt", 1)
        r2 = kb.add_document("r1", "b.txt", "txt", 1)
        assert r1.document_id != r2.document_id

    def test_add_document_custom_id(self) -> None:
        """Should accept a custom document_id."""
        kb = KnowledgeBase()
        record = kb.add_document("r1", "test.txt", "txt", 3, document_id="custom-id")
        assert record.document_id == "custom-id"

    def test_get_document_returns_record(self) -> None:
        """get_document() should return the stored record."""
        kb = KnowledgeBase()
        record = kb.add_document("r1", "test.txt", "txt", 1)
        fetched = kb.get_document(record.document_id)
        assert fetched is not None
        assert fetched.document_id == record.document_id

    def test_get_document_nonexistent_returns_none(self) -> None:
        """get_document() for nonexistent ID should return None."""
        kb = KnowledgeBase()
        assert kb.get_document("nonexistent") is None

    def test_list_documents_filters_by_restaurant(self) -> None:
        """list_documents() should only return documents for the given restaurant."""
        kb = KnowledgeBase()
        kb.add_document("r1", "a.txt", "txt", 1)
        kb.add_document("r2", "b.txt", "txt", 1)
        kb.add_document("r1", "c.txt", "txt", 1)
        r1_docs = kb.list_documents("r1")
        assert len(r1_docs) == 2
        assert all(d.restaurant_id == "r1" for d in r1_docs)

    def test_delete_document_removes_record(self) -> None:
        """delete_document() should remove the document and return True."""
        kb = KnowledgeBase()
        record = kb.add_document("r1", "test.txt", "txt", 1)
        result = kb.delete_document(record.document_id, "r1")
        assert result is True
        assert kb.get_document(record.document_id) is None

    def test_delete_document_wrong_restaurant_returns_false(self) -> None:
        """delete_document() with wrong restaurant_id should return False."""
        kb = KnowledgeBase()
        record = kb.add_document("r1", "test.txt", "txt", 1)
        result = kb.delete_document(record.document_id, "r2")
        assert result is False
        assert kb.get_document(record.document_id) is not None

    def test_delete_nonexistent_document_returns_false(self) -> None:
        """delete_document() for nonexistent ID should return False."""
        kb = KnowledgeBase()
        assert kb.delete_document("nonexistent", "r1") is False

    def test_count_scoped_and_unscoped(self) -> None:
        """count() should work scoped and unscoped."""
        kb = KnowledgeBase()
        kb.add_document("r1", "a.txt", "txt", 1)
        kb.add_document("r1", "b.txt", "txt", 1)
        kb.add_document("r2", "c.txt", "txt", 1)
        assert kb.count() == 3
        assert kb.count("r1") == 2
        assert kb.count("r2") == 1
        assert kb.count("r3") == 0

    def test_clear_all(self) -> None:
        """clear() without args should remove everything."""
        kb = KnowledgeBase()
        kb.add_document("r1", "a.txt", "txt", 1)
        kb.add_document("r2", "b.txt", "txt", 1)
        kb.clear()
        assert kb.count() == 0

    def test_clear_scoped(self) -> None:
        """clear() with restaurant_id should only remove matching documents."""
        kb = KnowledgeBase()
        kb.add_document("r1", "a.txt", "txt", 1)
        kb.add_document("r2", "b.txt", "txt", 1)
        kb.clear("r1")
        assert kb.count("r1") == 0
        assert kb.count("r2") == 1

    def test_singleton_get_knowledge_base(self) -> None:
        """get_knowledge_base() should return the same instance."""
        kb1 = get_knowledge_base()
        kb2 = get_knowledge_base()
        assert kb1 is kb2


# ═══════════════════════════════════════════════════════════════════════════════
# DocumentLoader
# ═══════════════════════════════════════════════════════════════════════════════


class TestDocumentLoader:
    """Unit tests for DocumentLoader."""

    @pytest.mark.asyncio
    async def test_load_txt_file(self) -> None:
        """load() should extract text from a TXT file."""
        loader = DocumentLoader()
        content = b"Hello, world!\nThis is a test document."
        text, doc_type = await loader.load(content, "test.txt")
        assert text == "Hello, world!\nThis is a test document."
        assert doc_type == "txt"

    @pytest.mark.asyncio
    async def test_load_md_file(self) -> None:
        """load() should extract text from a Markdown file."""
        loader = DocumentLoader()
        content = b"# Heading\n\nSome **bold** text."
        text, doc_type = await loader.load(content, "readme.md")
        assert "# Heading" in text
        assert doc_type == "md"

    @pytest.mark.asyncio
    async def test_load_markdown_extension(self) -> None:
        """load() should recognize .markdown extension."""
        loader = DocumentLoader()
        content = b"# Markdown"
        text, doc_type = await loader.load(content, "doc.markdown")
        assert doc_type == "md"

    @pytest.mark.asyncio
    async def test_load_text_extension(self) -> None:
        """load() should recognize .text extension."""
        loader = DocumentLoader()
        content = b"Plain text"
        text, doc_type = await loader.load(content, "notes.text")
        assert doc_type == "txt"

    @pytest.mark.asyncio
    async def test_load_empty_content_raises(self) -> None:
        """load() with empty bytes should raise ValueError."""
        loader = DocumentLoader()
        with pytest.raises(ValueError, match="empty"):
            await loader.load(b"", "test.txt")

    @pytest.mark.asyncio
    async def test_load_oversized_file_raises(self) -> None:
        """load() with content exceeding MAX_FILE_SIZE should raise ValueError."""
        loader = DocumentLoader()
        large_content = b"x" * (loader.MAX_FILE_SIZE + 1)
        with pytest.raises(ValueError, match="exceeds maximum"):
            await loader.load(large_content, "test.txt")

    @pytest.mark.asyncio
    async def test_load_unsupported_extension_raises(self) -> None:
        """load() with unsupported extension should raise ValueError."""
        loader = DocumentLoader()
        with pytest.raises(ValueError, match="Unsupported"):
            await loader.load(b"content", "image.png")

    @pytest.mark.asyncio
    async def test_load_no_extractable_text_raises(self) -> None:
        """load() with whitespace-only content should raise ValueError."""
        loader = DocumentLoader()
        with pytest.raises(ValueError, match="No extractable text"):
            await loader.load(b"   \n  \t  ", "test.txt")

    @pytest.mark.asyncio
    async def test_load_latin1_fallback(self) -> None:
        """load() should fall back to latin-1 for non-UTF-8 content."""
        loader = DocumentLoader()
        # Create bytes that are valid in latin-1 but not UTF-8
        content = bytes([0x48, 0xE9, 0x6C, 0x6C, 0x6F])  # "Héllo" in latin-1
        text, doc_type = await loader.load(content, "test.txt")
        assert "H" in text
        assert doc_type == "txt"

    def test_detect_type_unknown_extension(self) -> None:
        """_detect_type() should return 'unknown' for unsupported extensions."""
        assert DocumentLoader._detect_type("file.xyz") == "unknown"

    def test_get_document_loader_factory(self) -> None:
        """get_document_loader() should return a DocumentLoader."""
        loader = get_document_loader()
        assert isinstance(loader, DocumentLoader)


# ═══════════════════════════════════════════════════════════════════════════════
# ModelManager
# ═══════════════════════════════════════════════════════════════════════════════


class TestModelManagerPrompt:
    """Unit tests for ModelManager._build_prompt."""

    def test_build_prompt_includes_question(self) -> None:
        """The prompt should include the user's question."""
        prompt = ModelManager._build_prompt("What is AuraOS?", "Some context", None)
        assert "What is AuraOS?" in prompt

    def test_build_prompt_includes_context(self) -> None:
        """The prompt should include the context documents."""
        prompt = ModelManager._build_prompt("Question", "Context text here", None)
        assert "Context text here" in prompt

    def test_build_prompt_includes_instructions(self) -> None:
        """The prompt should include system instructions."""
        prompt = ModelManager._build_prompt("Q", "C", None)
        assert "AI assistant" in prompt
        assert "ONLY the provided context" in prompt

    def test_build_prompt_includes_conversation_history(self) -> None:
        """The prompt should include conversation history when provided."""
        history = "User: Hello\nAI: Hi there!"
        prompt = ModelManager._build_prompt("Q", "C", history)
        assert "Conversation History" in prompt
        assert history in prompt

    def test_build_prompt_no_history_omits_section(self) -> None:
        """The prompt should not include history section when None."""
        prompt = ModelManager._build_prompt("Q", "C", None)
        assert "Conversation History" not in prompt


class TestModelManagerGenerate:
    """Tests for ModelManager.generate_answer()."""

    @pytest.mark.asyncio
    async def test_generate_answer_returns_rag_answer(self) -> None:
        """generate_answer() should return a RAGAnswer."""
        mgr = ModelManager()
        with patch("app.providers.get_provider") as mock_get:
            mock_provider = AsyncMock()
            mock_provider.generate.return_value = "This is the answer."
            mock_provider.name = "mock"
            mock_get.return_value = mock_provider

            answer = await mgr.generate_answer("What is it?", "Some context")
            assert isinstance(answer, RAGAnswer)
            assert answer.answer == "This is the answer."
            assert answer.provider == "mock"

    @pytest.mark.asyncio
    async def test_generate_answer_has_latency(self) -> None:
        """The answer should include a latency_ms value."""
        mgr = ModelManager()
        with patch("app.providers.get_provider") as mock_get:
            mock_provider = AsyncMock()
            mock_provider.generate.return_value = "Answer"
            mock_provider.name = "mock"
            mock_get.return_value = mock_provider

            answer = await mgr.generate_answer("Q", "C")
            assert answer.latency_ms > 0

    @pytest.mark.asyncio
    async def test_generate_answer_has_token_usage(self) -> None:
        """The answer should include approximate token usage."""
        mgr = ModelManager()
        with patch("app.providers.get_provider") as mock_get:
            mock_provider = AsyncMock()
            mock_provider.generate.return_value = "Answer"
            mock_provider.name = "mock"
            mock_get.return_value = mock_provider

            answer = await mgr.generate_answer("Q", "C")
            assert answer.token_usage > 0

    @pytest.mark.asyncio
    async def test_generate_answer_fallback_on_error(self) -> None:
        """When the provider fails, should return fallback answer."""
        mgr = ModelManager()
        with patch("app.providers.get_provider") as mock_get:
            mock_provider = AsyncMock()
            mock_provider.generate.side_effect = RuntimeError("LLM down")
            mock_provider.name = "mock"
            mock_get.return_value = mock_provider

            answer = await mgr.generate_answer("What is it?", "Context")
            assert answer.provider == "fallback"
            assert len(answer.answer) > 0

    @pytest.mark.asyncio
    async def test_health_check_returns_bool(self) -> None:
        """health_check() should return a bool."""
        mgr = ModelManager()
        with patch("app.providers.get_provider") as mock_get:
            mock_provider = AsyncMock()
            mock_provider.health_check.return_value = True
            mock_get.return_value = mock_provider

            result = await mgr.health_check()
            assert result is True

    @pytest.mark.asyncio
    async def test_health_check_returns_false_on_error(self) -> None:
        """health_check() should return False on exception."""
        mgr = ModelManager()
        with patch("app.providers.get_provider") as mock_get:
            mock_provider = AsyncMock()
            mock_provider.health_check.side_effect = RuntimeError("Down")
            mock_get.return_value = mock_provider

            result = await mgr.health_check()
            assert result is False


class TestGetModelManager:
    """Tests for the singleton factory."""

    def test_get_model_manager_returns_singleton(self) -> None:
        """Multiple calls should return the same instance."""
        m1 = get_model_manager()
        m2 = get_model_manager()
        assert m1 is m2

    def test_get_model_manager_returns_model_manager(self) -> None:
        """Should return a ModelManager instance."""
        mgr = get_model_manager()
        assert isinstance(mgr, ModelManager)


# ═══════════════════════════════════════════════════════════════════════════════
# RAGAnswer
# ═══════════════════════════════════════════════════════════════════════════════


class TestRAGAnswer:
    """Unit tests for RAGAnswer dataclass."""

    def test_rag_answer_creation(self) -> None:
        """RAGAnswer should be creatable with all fields."""
        answer = RAGAnswer(
            answer="Test answer",
            provider="mock",
            token_usage=100,
            latency_ms=50.5,
        )
        assert answer.answer == "Test answer"
        assert answer.provider == "mock"
        assert answer.token_usage == 100
        assert answer.latency_ms == 50.5

    def test_rag_answer_default_sources(self) -> None:
        """sources should default to empty list."""
        answer = RAGAnswer(answer="A", provider="mock", token_usage=10, latency_ms=1.0)
        assert answer.sources == []