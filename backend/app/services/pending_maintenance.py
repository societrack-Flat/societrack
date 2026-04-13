"""
Pending Maintenance Service
Handles all operations related to pending maintenance tracking for flats
"""

from typing import List, Optional
from decimal import Decimal
from sqlalchemy.orm import Session
from app.models.flat import Flat
from app.schemas.pending_maintenance import PendingMaintenanceUpdate, PendingMaintenanceReport
from fastapi import HTTPException
import csv
import io

class PendingMaintenanceService:
    
    @staticmethod
    async def update_pending_maintenance(
        db: Session, 
        flat_id: str, 
        amount: Decimal
    ) -> Flat:
        """Update pending maintenance amount for a specific flat"""
        
        flat = db.query(Flat).filter(Flat.id == flat_id).first()
        if not flat:
            raise HTTPException(status_code=404, detail="Flat not found")
        
        if amount < 0:
            raise HTTPException(status_code=400, detail="Pending maintenance cannot be negative")
        
        flat.pending_maintenance = amount
        db.commit()
        db.refresh(flat)
        
        return flat
    
    @staticmethod
    async def get_pending_maintenance_report(
        db: Session, 
        apartment_id: Optional[str] = None
    ) -> List[PendingMaintenanceReport]:
        """Get report of all flats with pending maintenance"""
        
        query = db.query(Flat).filter(Flat.pending_maintenance > 0)
        
        if apartment_id:
            query = query.filter(Flat.apartment_id == apartment_id)
        
        flats = query.order_by(Flat.flat_number).all()
        
        return [
            PendingMaintenanceReport(
                flat_number=flat.flat_number,
                resident_name=flat.resident_name,
                resident_phone=flat.resident_phone,
                resident_email=flat.resident_email,
                pending_amount=flat.pending_maintenance
            )
            for flat in flats
        ]
    
    @staticmethod
    async def export_pending_maintenance_csv(
        db: Session, 
        apartment_id: Optional[str] = None
    ) -> str:
        """Export pending maintenance data as CSV"""
        
        report = await PendingMaintenanceService.get_pending_maintenance_report(
            db, apartment_id
        )
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write headers
        writer.writerow([
            'Flat Number', 
            'Resident Name', 
            'Resident Phone', 
            'Resident Email', 
            'Pending Amount'
        ])
        
        # Write data
        for item in report:
            writer.writerow([
                item.flat_number,
                item.resident_name or '',
                item.resident_phone or '',
                item.resident_email or '',
                str(item.pending_amount)
            ])
        
        return output.getvalue()
    
    @staticmethod
    async def get_total_pending_maintenance(
        db: Session, 
        apartment_id: Optional[str] = None
    ) -> Decimal:
        """Get total pending maintenance amount"""
        
        query = db.query(Flat).filter(Flat.pending_maintenance > 0)
        
        if apartment_id:
            query = query.filter(Flat.apartment_id == apartment_id)
        
        result = query.with_entities(
            db.func.sum(Flat.pending_maintenance)
        ).scalar()
        
        return result or Decimal('0.00')
    
    @staticmethod
    async def clear_pending_maintenance(
        db: Session, 
        flat_id: str
    ) -> Flat:
        """Clear pending maintenance for a flat (when payment is received)"""
        
        return await PendingMaintenanceService.update_pending_maintenance(
            db, flat_id, Decimal('0.00')
        )
