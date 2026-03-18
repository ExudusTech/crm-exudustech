-- Fix profiles insert policy to be more restrictive
DROP POLICY "Allow insert profiles" ON public.profiles;
CREATE POLICY "Allow insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Insert profile for existing admin user and assign admin role
INSERT INTO public.profiles (id, full_name)
SELECT id, email FROM auth.users WHERE email = 'ph@exudustech.com.br'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'ph@exudustech.com.br'
ON CONFLICT (user_id, role) DO NOTHING;