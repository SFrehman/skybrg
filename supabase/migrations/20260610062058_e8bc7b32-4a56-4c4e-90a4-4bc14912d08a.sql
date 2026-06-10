
CREATE TABLE public.students (
  college_roll text PRIMARY KEY,
  uni_roll text NOT NULL,
  name text NOT NULL,
  short_name text NOT NULL,
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.students TO anon, authenticated;
GRANT ALL ON public.students TO service_role;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "anyone update students" ON public.students FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anyone insert students" ON public.students FOR INSERT WITH CHECK (true);
