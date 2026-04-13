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


def require_user(authorization: str | None = Header(default=None), x_service_role: str | None = Header(default=None)):
    """
    Verifies a Supabase JWT (if SUPABASE_JWT_SECRET is provided).
    Returns decoded claims. If secret is not configured, performs only basic checks.
    If X-Service-Role header is present, bypasses auth for service operations.
    """
    # Bypass auth for service role operations
    if x_service_role == "true":
        return {"service_role": True}
    
    token = _extract_bearer(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    if not settings.supabase_jwt_secret:
        # Minimal validation only (keeps dev unblocked). For production set SUPABASE_JWT_SECRET.
        return {"token_present": True}

    try:
        claims = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

