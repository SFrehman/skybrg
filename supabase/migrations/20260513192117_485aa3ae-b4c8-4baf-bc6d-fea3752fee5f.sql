ALTER TABLE public.files ADD COLUMN IF NOT EXISTS text_content text;
ALTER TABLE public.files ALTER COLUMN storage_path DROP NOT NULL;