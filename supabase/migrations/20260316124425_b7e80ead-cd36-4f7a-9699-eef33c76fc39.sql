ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS max_bestyrelsesmedlemmer integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS max_suppleanter integer DEFAULT 2;