
-- evaluations_staff_1: allow public select, insert, update
CREATE POLICY "Allow all to select" ON public.evaluations_staff_1 FOR SELECT USING (true);
CREATE POLICY "Allow all to insert" ON public.evaluations_staff_1 FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all to update" ON public.evaluations_staff_1 FOR UPDATE USING (true) WITH CHECK (true);

-- evaluations_store: allow public select, insert, update
CREATE POLICY "Allow all to select" ON public.evaluations_store FOR SELECT USING (true);
CREATE POLICY "Allow all to insert" ON public.evaluations_store FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all to update" ON public.evaluations_store FOR UPDATE USING (true) WITH CHECK (true);
