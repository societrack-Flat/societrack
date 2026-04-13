-- Migration: Add pending_maintenance column to flats table
-- Purpose: Track outstanding maintenance amounts per flat

-- Add the pending_maintenance column
ALTER TABLE flats 
ADD COLUMN pending_maintenance DECIMAL(10,2) DEFAULT 0.00 NOT NULL;

-- Add constraint to ensure non-negative values
ALTER TABLE flats 
ADD CONSTRAINT chk_pending_maintenance_non_negative 
CHECK (pending_maintenance >= 0);

-- Create index for performance on pending maintenance queries
CREATE INDEX idx_flats_pending_maintenance ON flats(pending_maintenance);

-- Add RLS policies for the new column if needed
-- (Assuming RLS is enabled, you may need to update existing policies)
