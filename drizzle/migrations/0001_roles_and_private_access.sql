CREATE TYPE public.app_role AS ENUM ('admin', 'barber');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.barbers ADD COLUMN user_id uuid UNIQUE;
ALTER TABLE public.barbers ADD COLUMN email text;

CREATE OR REPLACE FUNCTION public.my_barber_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.barbers WHERE user_id = auth.uid() LIMIT 1
$$;

DROP POLICY IF EXISTS "open access" ON public.barbers;
DROP POLICY IF EXISTS "open access" ON public.services;
DROP POLICY IF EXISTS "open access" ON public.appointments;
REVOKE ALL ON public.barbers, public.services, public.appointments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbers, public.services, public.appointments TO authenticated;
GRANT ALL ON public.barbers, public.services, public.appointments TO service_role;

CREATE POLICY "barbers read" ON public.barbers FOR SELECT TO authenticated USING (true);
CREATE POLICY "barbers admin write" ON public.barbers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "services read" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "services admin write" ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "appts read" ON public.appointments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR barber_id = public.my_barber_id());
CREATE POLICY "appts insert" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR barber_id = public.my_barber_id());
CREATE POLICY "appts delete" ON public.appointments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR barber_id = public.my_barber_id());
CREATE POLICY "appts admin update" ON public.appointments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.appointments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;