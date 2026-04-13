from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional

from app.services.auth import require_user
from app.services.supabase_rest import supabase_rest


router = APIRouter(prefix="/api/apartments", tags=["apartments"])


@router.get("")
async def get_apartments(
    user_id: str,
    active_apartment_id: Optional[str] = None,
    exclude_apartment_id: Optional[str] = None,
    _claims=Depends(require_user),
):
    """
    Get all apartments for a user, with optional filtering.
    """
    sb = supabase_rest()
    
    # Fetch apartments created by user
    params = {
        "select": "*",
        "created_by": f"eq.{user_id}",
        "order": "created_at.desc",
    }
    
    # Exclude specific apartment if provided
    if exclude_apartment_id:
        params["id"] = f"neq.{exclude_apartment_id}"
    
    apartments = await sb.get("apartments", params=params)
    
    # If active apartment is not in the list, fetch it separately
    if active_apartment_id and active_apartment_id != exclude_apartment_id:
        active_exists = any(apt["id"] == active_apartment_id for apt in apartments)
        if not active_exists:
            active_params = {
                "select": "*",
                "id": f"eq.{active_apartment_id}",
            }
            if exclude_apartment_id:
                active_params["id"] = f"eq.{active_apartment_id}"
            try:
                active_apt = await sb.get("apartments", params=active_params)
                if active_apt:
                    apartments.append(active_apt[0])
            except:
                pass  # Active apartment might not exist or no permission
    
    return apartments


@router.post("")
async def create_apartment(
    apartment_data: dict,
    user_id: str,
    _claims=Depends(require_user),
):
    """
    Create a new apartment.
    """
    sb = supabase_rest()
    
    # Add created_by field
    apartment_data["created_by"] = user_id
    
    try:
        result = await sb.post("apartments", json=apartment_data)
        return result[0] if result else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{apartment_id}")
async def update_apartment(
    apartment_id: str,
    apartment_data: dict,
    _claims=Depends(require_user),
):
    """
    Update an existing apartment.
    """
    sb = supabase_rest()
    
    try:
        result = await sb.patch(
            "apartments", 
            params={"id": f"eq.{apartment_id}"}, 
            json=apartment_data
        )
        return result[0] if result else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{apartment_id}")
async def delete_apartment(
    apartment_id: str,
    _claims=Depends(require_user),
):
    """
    Delete an apartment and all its dependent data.
    """
    print(f"[DEBUG] Delete apartment called for ID: {apartment_id}")
    print(f"[DEBUG] Claims: {_claims}")
    
    sb = supabase_rest()
    print(f"[DEBUG] Supabase client created")
    
    try:
        # Delete in order to respect foreign key constraints
        tables_to_delete = [
            "maintenance",
            "income", 
            "expenses",
            "announcements",
            "viewer_settings", 
            "payment_history",
            "income_categories",
            "expense_categories",
            "flats",
        ]
        
        print(f"[DEBUG] Starting to delete from {len(tables_to_delete)} tables")
        
        # Delete from all dependent tables
        for table in tables_to_delete:
            try:
                await sb.delete(table, params={"apartment_id": f"eq.{apartment_id}"})
            except:
                pass  # Table might not exist or no records
        
        # Clear user references
        await sb.patch(
            "users",
            params={"apartment_id": f"eq.{apartment_id}"},
            json={"apartment_id": None}
        )
        
        # Delete the apartment itself
        await sb.delete("apartments", params={"id": f"eq.{apartment_id}"})
        
        return {"message": "Apartment deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/user/{user_id}")
async def get_user_apartments(
    user_id: str,
    _claims=Depends(require_user),
):
    """
    Get all apartments for a specific user.
    """
    sb = supabase_rest()
    
    params = {
        "select": "*",
        "created_by": f"eq.{user_id}",
        "order": "created_at.desc",
    }
    
    apartments = await sb.get("apartments", params=params)
    return apartments or []


@router.patch("/{apartment_id}/set-active")
async def set_active_apartment(
    apartment_id: str,
    user_id: str,
    _claims=Depends(require_user),
):
    """
    Set an apartment as active for a user.
    """
    sb = supabase_rest()
    
    try:
        # Update user's active apartment
        result = await sb.patch(
            "users",
            params={"id": f"eq.{user_id}"},
            json={"apartment_id": apartment_id if apartment_id != "null" else None}
        )
        
        # Get updated user profile
        user_params = {
            "select": "*",
            "id": f"eq.{user_id}",
        }
        user_profile = await sb.get("users", params=user_params)
        
        return {
            "message": "Active apartment updated successfully",
            "user": user_profile[0] if user_profile else None
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
