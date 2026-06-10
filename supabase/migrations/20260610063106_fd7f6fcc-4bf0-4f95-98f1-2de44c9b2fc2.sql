
-- Add avatar to students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS avatar_url text;

-- Signup requests table
CREATE TABLE IF NOT EXISTS public.signup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_roll text NOT NULL,
  uni_roll text NOT NULL,
  name text NOT NULL,
  short_name text NOT NULL,
  whatsapp text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signup_requests TO anon, authenticated;
GRANT ALL ON public.signup_requests TO service_role;

ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone insert signup_requests" ON public.signup_requests FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "anyone read signup_requests" ON public.signup_requests FOR SELECT TO public USING (true);
CREATE POLICY "anyone update signup_requests" ON public.signup_requests FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "anyone delete signup_requests" ON public.signup_requests FOR DELETE TO public USING (true);
