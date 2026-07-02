"""Tests for RAG Upload endpoint — Milestone 7.

POST /api/v1/rag/upload — multipart document upload with JWT auth.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/v1/rag/upload
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestUploadAuth:
    """Authentication tests for the upload endpoint."""

    async def test_upload_requires_auth(self, client: AsyncClient) -> None:
        """POST /upload without auth header should return 401."""
        response = await client.post(
            "/api/v1/rag/upload",
            files={"file": ("test.txt", b"hello world", "text/plain")},
        )
        assert response.status_code == 401

    async def test_upload_with_expired_token(
        self, client: AsyncClient, expired_token: str
    ) -> None:
        """POST /upload with an expired JWT should return 401."""
        response = await client.post(
            "/api/v1/rag/upload",
            headers={"Authorization": f"Bearer {expired_token}"},
            files={"file": ("test.txt", b"hello world", "text/plain")},
        )
        assert response.status_code == 401

    async def test_upload_with_invalid_token(self, client: AsyncClient) -> None:
        """POST /upload with a malformed JWT should return 401."""
        response = await client.post(
            "/api/v1/rag/upload",
            headers={"Authorization": "Bearer not.a.real.token"},
            files={"file": ("test.txt", b"hello world", "text/plain")},
        )
        assert response.status_code == 401

    async def test_upload_missing_bearer_prefix(self, client: AsyncClient) -> None:
        """POST /upload with a token missing 'Bearer ' should return 401."""
        response = await client.post(
            "/api/v1/rag/upload",
            headers={"Authorization": "some-token-without-bearer"},
            files={"file": ("test.txt", b"hello world", "text/plain")},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestUploadValid:
    """Successful upload tests."""

    async def test_upload_txt_file(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """Upload a valid TXT file should return 200 with UploadResponse."""
        response = await client.post(
            "/api/v1/rag/upload",
            headers=auth_headers,
            files={"file": ("sample.txt", b"This is a sample text document for RAG testing.", "text/plain")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["document_id"] is not None
        assert data["filename"] == "sample.txt"
        assert data["document_type"] == "txt"
        assert data["chunks"] >= 1

    async def test_upload_markdown_file(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """Upload a valid Markdown file should return 200."""
        md_content = b"# Heading\n\nThis is a markdown document.\n\n## Section\n\nContent here."
        response = await client.post(
            "/api/v1/rag/upload",
            headers=auth_headers,
            files={"file": ("doc.md", md_content, "text/markdown")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["document_type"] == "md"

    async def test_upload_creates_unique_document_ids(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """Uploading two files should create different document IDs."""
        resp1 = await client.post(
            "/api/v1/rag/upload",
            headers=auth_headers,
            files={"file": ("file1.txt", b"First document.", "text/plain")},
        )
        resp2 = await client.post(
            "/api/v1/rag/upload",
            headers=auth_headers,
            files={"file": ("file2.txt", b"Second document.", "text/plain")},
        )
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        assert resp1.json()["document_id"] != resp2.json()["document_id"]


@pytest.mark.asyncio
class TestUploadErrors:
    """Error handling tests for the upload endpoint."""

    async def test_upload_empty_file(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """Uploading an empty file should return 422."""
        response = await client.post(
            "/api/v1/rag/upload",
            headers=auth_headers,
            files={"file": ("empty.txt", b"", "text/plain")},
        )
        assert response.status_code == 422

    async def test_upload_unsupported_extension(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """Uploading a file with unsupported extension should return 422."""
        response = await client.post(
            "/api/v1/rag/upload",
            headers=auth_headers,
            files={"file": ("image.png", b"\x89PNG\x0d\x0a\x1a\x0a", "image/png")},
        )
        assert response.status_code == 422

    async def test_upload_no_file(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """POST /upload without a file should return 422."""
        response = await client.post(
            "/api/v1/rag/upload",
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_upload_filename_without_extension(
        self, client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        """Uploading a file with no extension should return 422."""
        response = await client.post(
            "/api/v1/rag/upload",
            headers=auth_headers,
            files={"file": ("noextension", b"some text content", "application/octet-stream")},
        )
        assert response.status_code == 422