"""RAG Package — Retrieval-Augmented Generation for Milestone 7.

Exports:
    - TextChunker: splits documents into overlapping chunks
    - EmbeddingModel: generates dense vector embeddings
    - VectorStoreBackend / InMemoryVectorStore: stores and retrieves vectors
    - HybridRetriever: hybrid vector + keyword retrieval
    - CitationBuilder: builds citation metadata for responses
    - KnowledgeBase: document metadata store
    - DocumentLoader: loads PDF, TXT, Markdown files
    - IngestionService: orchestrates the full ingestion pipeline
    - ModelManager: manages LLM provider for RAG answer generation
"""

from app.rag.chunker import Chunk, TextChunker
from app.rag.citation_builder import Citation, CitationBuilder, get_citation_builder
from app.rag.document_loader import DocumentLoader, get_document_loader
from app.rag.embeddings import EmbeddingModel, get_embedding_model
from app.rag.ingestion_service import IngestionService, get_ingestion_service
from app.rag.knowledge_base import DocumentRecord, KnowledgeBase, get_knowledge_base
from app.rag.model_manager import ModelManager, RAGAnswer, get_model_manager
from app.rag.retriever import HybridRetriever, RetrievalResult, get_retriever
from app.rag.vector_store import (
    InMemoryVectorStore,
    VectorEntry,
    VectorStoreBackend,
    get_vector_store,
    reset_vector_store,
)

__all__ = [
    "Chunk",
    "TextChunker",
    "Citation",
    "CitationBuilder",
    "get_citation_builder",
    "DocumentLoader",
    "get_document_loader",
    "EmbeddingModel",
    "get_embedding_model",
    "DocumentRecord",
    "KnowledgeBase",
    "get_knowledge_base",
    "IngestionService",
    "get_ingestion_service",
    "ModelManager",
    "RAGAnswer",
    "get_model_manager",
    "HybridRetriever",
    "RetrievalResult",
    "get_retriever",
    "InMemoryVectorStore",
    "VectorEntry",
    "VectorStoreBackend",
    "get_vector_store",
    "reset_vector_store",
]