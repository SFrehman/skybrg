
-- Settings table for app-wide config like passkey
CREATE TABLE public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on settings" ON public.settings FOR SELECT TO public USING (true);
CREATE POLICY "Allow all update on settings" ON public.settings FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all insert on settings" ON public.settings FOR INSERT TO public WITH CHECK (true);

-- Insert default passkey
INSERT INTO public.settings (key, value) VALUES ('upload_passkey', 'Saif_Jani');

-- Enable realtime for files table
ALTER PUBLICATION supabase_realtime ADD TABLE public.files;
