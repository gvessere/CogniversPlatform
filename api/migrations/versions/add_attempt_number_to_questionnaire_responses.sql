-- Add attempt_number column to questionnaire_responses table
ALTER TABLE questionnaire_responses ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1;

-- Update existing responses with attempt numbers based on order
WITH numbered_responses AS (
  SELECT 
    id,
    questionnaire_id,
    user_id,
    started_at,
    ROW_NUMBER() OVER (PARTITION BY questionnaire_id, user_id ORDER BY started_at) as attempt_num
  FROM questionnaire_responses
)
UPDATE questionnaire_responses
SET attempt_number = numbered_responses.attempt_num
FROM numbered_responses
WHERE questionnaire_responses.id = numbered_responses.id; 