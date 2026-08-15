-- settings: remove fully public access; passkey is server-only now
DROP POLICY IF EXISTS "Allow all select on settings" ON public.settings;
DROP POLICY IF EXISTS "Allow all insert on settings" ON public.settings;
DROP POLICY IF EXISTS "Allow all update on settings" ON public.settings;

REVOKE ALL ON public.settings FROM anon, authenticated;
GRANT ALL ON public.settings TO service_role;

-- student_credentials: service_role only, no policies (deny by default)
REVOKE ALL ON public.student_credentials FROM anon, authenticated;
GRANT ALL ON public.student_credentials TO service_role;

-- signup_requests: anyone may submit, nobody may read/modify from the client
REVOKE ALL ON public.signup_requests FROM anon, authenticated;
GRANT INSERT ON public.signup_requests TO anon, authenticated;
GRANT ALL ON public.signup_requests TO service_role;

-- students: public read stays (needed for login lookup), writes are server-only
REVOKE INSERT, UPDATE, DELETE ON public.students FROM anon, authenticated;
GRANT SELECT ON public.students TO anon, authenticated;
GRANT ALL ON public.students TO service_role;