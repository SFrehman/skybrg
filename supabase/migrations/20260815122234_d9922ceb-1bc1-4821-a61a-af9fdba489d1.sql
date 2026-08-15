INSERT INTO public.student_credentials (college_roll, password_hash, updated_at)
VALUES ('224', 'e013502bd8555c671d7cfa6e8e01ad06d24acdcf84d7a349ae80a9c1fa1394d7', now())
ON CONFLICT (college_roll) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now();