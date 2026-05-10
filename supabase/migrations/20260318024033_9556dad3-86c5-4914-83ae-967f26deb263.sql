CREATE POLICY "Allow public insert on product_infomation"
ON public.product_infomation
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public update on product_infomation"
ON public.product_infomation
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public select on product_infomation"
ON public.product_infomation
FOR SELECT
TO public
USING (true);