"""
JWT authentication utilities for the AI Analytics service.

Validates tokens issued by the AuraOS Core API (Node.js) — does NOT create
tokens or user accounts.  The token payload is expected to contain:

    {
        "id":            "<uuid>",
        "email":         "<string>",
        "role":          "<ADMIN|WAITER|RECEPTION|KITCHEN>",
        "restaurantId":  "<uuid>",
        "iat":           <unix_ts>,
        "exp":           <unix_ts>,
    }

All endpoints that return restaurant-scoped data must validate the JWT and
extract the restaurantId to enforce multi-tenancy.
"""

from __future__ import annotations

from typing import Annotated, Any

import jwt
from fastapi import Depends, Header, HTTPException, status
from pydantic import BaseModel

from app.config.settings import settings


# ── Token payload model ─────────────────────────────────────────────────────────


class TokenPayload(BaseModel):
    """Structure of a decoded AuraOS JWT access token."""

    id: str  # user UUID
    email: str
    role: str
    restaurantId: str
    iat: int | None = None
    exp: int | None = None


# ── Exceptions ──────────────────────────────────────────────────────────────────


class InvalidTokenError(HTTPException):
    def __init__(self, detail: str = "Invalid or expired token") -> None:
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


class ForbiddenError(HTTPException):
    def __init__(self, detail: str = "Insufficient permissions") -> None:
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


# ── Dependency ──────────────────────────────────────────────────────────────────


async def decode_token(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> TokenPayload:
    """
    FastAPI dependency that validates the Bearer token and returns the decoded
    payload.

    Raises 401 if the header is missing or the token is invalid.
    """
    if not authorization:
        raise InvalidTokenError("Missing Authorization header")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise InvalidTokenError("Authorization header must be: Bearer <token>")

    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["exp", "id", "restaurantId"]},
        )
    except jwt.ExpiredSignatureError:
        raise InvalidTokenError("Token has expired")
    except jwt.InvalidTokenError as exc:
        raise InvalidTokenError(f"Invalid token: {exc}")

    return TokenPayload(
        id=payload["id"],
        email=payload.get("email", ""),
        role=payload.get("role", ""),
        restaurantId=payload["restaurantId"],
        iat=payload.get("iat"),
        exp=payload.get("exp"),
    )


# Type alias for endpoint signatures
CurrentUser = Annotated[TokenPayload, Depends(decode_token)]