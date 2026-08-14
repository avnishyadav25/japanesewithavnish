-- Add image_prompt to posts for storing AI-generated image prompts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_prompt TEXT;
