"""
API endpoints for pending maintenance operations
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import Optional
from decimal import Decimal
from datetime import datetime

from app.database import get_db
from app.services.pending_maintenance import PendingMaintenanceService
from app.schemas.pending_maintenance import (
    PendingMaintenanceUpdate, 
    PendingMaintenanceReport,
    PendingMaintenanceSummary,
    PendingMaintenanceExport
)

router = APIRouter(prefix="/api/pending-maintenance", tags=["pending-maintenance"])

@router.put("/flats/{flat_id}", response_model=dict)
async def update_pending_maintenance(
    flat_id: str,
    update_data: PendingMaintenanceUpdate,
    db: Session = Depends(get_db)
):
    """Update pending maintenance amount for a specific flat"""
    try:
        flat = await PendingMaintenanceService.update_pending_maintenance(
            db, flat_id, update_data.amount
        )
        return {
            "success": True,
            "message": "Pending maintenance updated successfully",
            "data": {
                "flat_id": flat.id,
                "flat_number": flat.flat_number,
                "pending_maintenance": float(flat.pending_maintenance)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/report", response_model=list[PendingMaintenanceReport])
async def get_pending_maintenance_report(
    apartment_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get report of all flats with pending maintenance"""
    try:
        return await PendingMaintenanceService.get_pending_maintenance_report(db, apartment_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/export")
async def export_pending_maintenance(
    apartment_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Export pending maintenance data as CSV"""
    try:
        csv_data = await PendingMaintenanceService.export_pending_maintenance_csv(db, apartment_id)
        filename = f"pending-maintenance-{datetime.now().strftime('%Y-%m-%d')}.csv"
        
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/summary", response_model=PendingMaintenanceSummary)
async def get_pending_maintenance_summary(
    apartment_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get summary of pending maintenance totals"""
    try:
        total_amount = await PendingMaintenanceService.get_total_pending_maintenance(db, apartment_id)
        report = await PendingMaintenanceService.get_pending_maintenance_report(db, apartment_id)
        
        return PendingMaintenanceSummary(
            total_amount=total_amount,
            flats_count=len(report),
            apartment_id=apartment_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/flats/{flat_id}/clear", response_model=dict)
async def clear_pending_maintenance(
    flat_id: str,
    db: Session = Depends(get_db)
):
    """Clear pending maintenance for a flat (when payment is received)"""
    try:
        flat = await PendingMaintenanceService.clear_pending_maintenance(db, flat_id)
        return {
            "success": True,
            "message": "Pending maintenance cleared successfully",
            "data": {
                "flat_id": flat.id,
                "flat_number": flat.flat_number,
                "pending_maintenance": float(flat.pending_maintenance)
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
