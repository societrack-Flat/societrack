from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from app.services.auth import require_user
from app.services.supabase_rest import supabase_rest


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/profile")
async def get_user_profile(
    user_id: str,
    _claims=Depends(require_user),
):
    """
    Get user profile by ID.
    """
    sb = supabase_rest()
    
    params = {
        "select": "*",
        "id": f"eq.{user_id}",
    }
    
    try:
        users = await sb.get("users", params=params)
        if not users:
            raise HTTPException(status_code=404, detail="User not found")
        return users[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/profile")
async def update_user_profile(
    user_id: str,
    profile_data: dict,
    _claims=Depends(require_user),
):
    """
    Update user profile.
    """
    sb = supabase_rest()
    
    try:
        result = await sb.patch(
            "users",
            params={"id": f"eq.{user_id}"},
            json=profile_data
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="User not found")
        
        return result[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/session")
async def get_session_info(
    _claims=Depends(require_user),
):
    """
    Get current session information.
    """
    return {
        "user_id": _claims.get("sub") if _claims else None,
        "email": _claims.get("email") if _claims else None,
        "role": _claims.get("app_role") if _claims else None,
        "exp": _claims.get("exp") if _claims else None,
    }
