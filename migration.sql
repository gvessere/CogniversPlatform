-- Add number_of_attempts column to the questionnaires table
ALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS number_of_attempts INTEGER NOT NULL; 