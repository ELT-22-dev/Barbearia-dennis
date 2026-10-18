GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbers, public.services, public.appointments TO anon;
CREATE POLICY "open access temp" ON public.barbers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access temp" ON public.services FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open access temp" ON public.appointments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);