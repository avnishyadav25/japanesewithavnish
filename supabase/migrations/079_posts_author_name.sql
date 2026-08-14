-- Blog author byline: free-text field, falls back to "Japanese with Avnish Editorial Team" in the UI when unset.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_name TEXT;
