-- Drop existing restrictive policies on files
DROP POLICY IF EXISTS "Users can view their own files" ON public.files;
DROP POLICY IF EXISTS "Users can insert their own files" ON public.files;
DROP POLICY IF EXISTS "Users can delete their own files" ON public.files;

-- Make user_id nullable since we won't use auth
ALTER TABLE public.files ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.files ALTER COLUMN user_id SET DEFAULT null;

-- Create open policies for single-user app
CREATE POLICY "Allow all select" ON public.files FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.files FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete" ON public.files FOR DELETE USING (true);

-- Drop existing restrictive storage policies
DROP POLICY IF EXISTS "Users can view their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;

-- Create open storage policies
CREATE POLICY "Allow all storage select" ON storage.objects FOR SELECT USING (bucket_id = 'user-files');
CREATE POLICY "Allow all storage insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'user-files');
CREATE POLICY "Allow all storage delete" ON storage.objects FOR DELETE USING (bucket_id = 'user-files');