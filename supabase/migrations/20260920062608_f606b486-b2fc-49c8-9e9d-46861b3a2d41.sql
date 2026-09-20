DROP POLICY IF EXISTS "Allow all insert" ON public.files;
DROP POLICY IF EXISTS "Allow all delete" ON public.files;
REVOKE INSERT, DELETE ON public.files FROM anon, authenticated;

DROP POLICY IF EXISTS "Allow all storage insert" ON storage.objects;
DROP POLICY IF EXISTS "Allow all storage delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow all storage update" ON storage.objects;