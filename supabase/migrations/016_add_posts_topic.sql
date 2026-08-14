-- Supabase may have topic on posts; ensure Neon has it for data import parity
ALTER TABLE posts ADD COLUMN IF NOT EXISTS topic TEXT;
