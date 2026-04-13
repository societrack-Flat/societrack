-- Add pending_maintenance column to flats table
-- This column tracks the outstanding/pending maintenance amount for each flat

ALTER TABLE flats 
ADD COLUMN pending_maintenance DECIMAL(10,2) DEFAULT 0.00;

-- Add comment to explain the column
COMMENT ON COLUMN flats.pending_maintenance IS 'Outstanding maintenance amount that needs to be paid by the resident';

-- Update existing flats to have default pending maintenance of 0
UPDATE flats 
SET pending_maintenance = 0.00 
WHERE pending_maintenance IS NULL;

-- Create index for better performance on pending maintenance queries
CREATE INDEX idx_flats_pending_maintenance ON flats(pending_maintenance) WHERE pending_maintenance > 0;
