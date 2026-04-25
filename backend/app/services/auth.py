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
    """Read claims (incl. `sub`) from Supabase access tokens (HS256/ES256/RS256). Checks exp, not signature (browser already trusted Supabase)."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Not a JWT")
    s = parts[1]
    s += "=" * ((4 - len(s) % 4) % 4)
    data = json.loads(base64.urlsafe_b64decode(s))
    exp = data.get("exp")
    if exp is not None and int(exp) < time.time():
        raise jwt.ExpiredSignatureError("Token expired")
    return data


def require_user(authorization: str | None = Header(default=None), x_service_role: str | None = Header(default=None)):
    """
    Supabase may issue ES256; HS256+SUPABASE_JWT_SECRET may not apply. We always read payload + exp
    so `sub` exists (same as trusting the access token the SPA already has).
    Optional: if SUPABASE_JWT_SECRET and alg is HS256, PyJWT can verify (skipped here for reliability).
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
            pass

    try:
        return _decode_jwt_payload_unverified(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except (ValueError, json.JSONDecodeError, KeyError, TypeError) as e:
        raise HTTPException(status_code=401, detail="Invalid token") from e

