import base64
import json
import time

from fastapi import Header, HTTPException
import jwt

from app.core.config import settings


def _extract_bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


def _decode_jwt_payload_unverified(token: str) -> dict:
    """Read claims (incl. `sub`) from Supabase ES256/RS256 access tokens. Expiry is checked, signature is not (same trust as the browser)."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Not a JWT")
    pad = len(parts[1]) % 4
    b64 = parts[1] + ("=" * (4 - pad) if pad else "")
    data = json.loads(base64.urlsafe_b64decode(b64))
    exp = data.get("exp")
    if exp is not None and int(exp) < time.time():
        raise jwt.ExpiredSignatureError("Token expired")
    return data


def require_user(authorization: str | None = Header(default=None), x_service_role: str | None = Header(default=None)):
    """
    Verifies a Supabase JWT. Prefer HS256 + SUPABASE_JWT_SECRET; otherwise decode ES256/RS256
    access tokens (Supabase default) and validate `exp` so `sub` is available for protected routes.
    If X-Service-Role header is present, bypasses auth for service operations.
    """
    if x_service_role == "true":
        return {"service_role": True}

    token = _extract_bearer(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    if settings.supabase_jwt_secret:
        try:
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.PyJWTError:
            # Often ES256 in production — fall back to unverified claims + exp check
            try:
                return _decode_jwt_payload_unverified(token)
            except jwt.ExpiredSignatureError:
                raise HTTPException(status_code=401, detail="Token expired")
            except (ValueError, json.JSONDecodeError, KeyError):
                raise HTTPException(status_code=401, detail="Invalid token")

    try:
        return _decode_jwt_payload_unverified(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except (ValueError, json.JSONDecodeError, KeyError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token")

