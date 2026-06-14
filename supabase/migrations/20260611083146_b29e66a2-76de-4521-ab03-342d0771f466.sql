
-- 1. New credentials table, locked down
CREATE TABLE IF NOT EXISTS public.student_credentials (
  college_roll text PRIMARY KEY,
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.student_credentials TO service_role;
ALTER TABLE public.student_credentials ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated have no access. Only service_role (via supabaseAdmin) can read/write.

-- 2. Migrate existing hashes (if any) before dropping the column
INSERT INTO public.student_credentials (college_roll, password_hash)
SELECT college_roll, password_hash FROM public.students WHERE password_hash IS NOT NULL
ON CONFLICT (college_roll) DO NOTHING;

-- 3. Drop public exposure of password_hash
ALTER TABLE public.students DROP COLUMN IF EXISTS password_hash;

-- 4. Tighten signup_requests: only allow public INSERT; reads/updates/deletes server-only
DROP POLICY IF EXISTS "anyone read signup_requests" ON public.signup_requests;
DROP POLICY IF EXISTS "anyone update signup_requests" ON public.signup_requests;
DROP POLICY IF EXISTS "anyone delete signup_requests" ON public.signup_requests;
-- "anyone insert signup_requests" remains so users can submit access requests.

REVOKE SELECT, UPDATE, DELETE ON public.signup_requests FROM anon, authenticated;
GRANT INSERT ON public.signup_requests TO anon, authenticated;
GRANT ALL ON public.signup_requests TO service_role;

-- 5. Tighten students table: anyone can still read names (needed for login lookup) but updates go via server
DROP POLICY IF EXISTS "anyone update students" ON public.students;
DROP POLICY IF EXISTS "anyone insert students" ON public.students;
REVOKE INSERT, UPDATE, DELETE ON public.students FROM anon, authenticated;
GRANT ALL ON public.students TO service_role;
