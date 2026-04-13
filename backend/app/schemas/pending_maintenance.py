"""
Pydantic schemas for pending maintenance operations
"""

from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field

class PendingMaintenanceUpdate(BaseModel):
    """Schema for updating pending maintenance amount"""
    amount: Decimal = Field(..., ge=0, description="Pending maintenance amount (must be non-negative)")

class PendingMaintenanceReport(BaseModel):
    """Schema for pending maintenance report entry"""
    flat_number: str = Field(..., description="Flat number")
    resident_name: Optional[str] = Field(None, description="Resident name")
    resident_phone: Optional[str] = Field(None, description="Resident phone")
    resident_email: Optional[str] = Field(None, description="Resident email")
    pending_amount: Decimal = Field(..., ge=0, description="Pending maintenance amount")

class PendingMaintenanceSummary(BaseModel):
    """Schema for pending maintenance summary"""
    total_amount: Decimal = Field(..., ge=0, description="Total pending maintenance amount")
    flats_count: int = Field(..., ge=0, description="Number of flats with pending maintenance")
    apartment_id: Optional[str] = Field(None, description="Apartment ID if filtered by apartment")

class PendingMaintenanceExport(BaseModel):
    """Schema for pending maintenance export response"""
    filename: str = Field(..., description="Export filename")
    content_type: str = Field(default="text/csv", description="Export content type")
    data: str = Field(..., description="CSV data as string")
