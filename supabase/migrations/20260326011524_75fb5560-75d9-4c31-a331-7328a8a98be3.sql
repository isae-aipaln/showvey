
CREATE OR REPLACE FUNCTION public.handle_product_image_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        UPDATE public.product_information
        SET 
            Thumbnail_url = 'https://akofewiugtsviauyvkkz.supabase.co/storage/v1/object/public/product_image/' || NEW.name || '/thumbnail/' || (SELECT name FROM storage.objects WHERE bucket_id = 'product_image' AND name LIKE NEW.name || '/thumbnail/%' LIMIT 1),
            Product_image_urls = (SELECT array_agg('https://akofewiugtsviauyvkkz.supabase.co/storage/v1/object/public/product_image/' || name) FROM storage.objects WHERE bucket_id = 'product_image' AND name LIKE NEW.name || '/item/%'),
            Coord_image_urls = (SELECT array_agg('https://akofewiugtsviauyvkkz.supabase.co/storage/v1/object/public/product_image/' || name) FROM storage.objects WHERE bucket_id = 'product_image' AND name LIKE NEW.name || '/coordi/%')
        WHERE Style_no = NEW.name;
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_product_image_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_style_no TEXT;
    v_category TEXT;
    v_full_url TEXT;
    v_project_id TEXT := 'akofewiugtsviauyvkkz'; 
    v_bucket_name TEXT := 'product_image';    
BEGIN
    v_style_no := split_part(OLD.name, '/', 1); 
    v_category := split_part(OLD.name, '/', 2); 
    v_full_url := 'https://' || v_project_id || '.supabase.co/storage/v1/object/public/' || v_bucket_name || '/' || OLD.name;

    IF v_category = 'thumbnail' THEN
        UPDATE public.product_information 
        SET "Thumbnail_url" = NULL 
        WHERE "Style_no" = v_style_no;

    ELSIF v_category = 'item' THEN
        UPDATE public.product_information 
        SET "Product_image_urls" = "Product_image_urls" - v_full_url
        WHERE "Style_no" = v_style_no;

    ELSIF v_category = 'coordi' THEN
        UPDATE public.product_information 
        SET "Coord_image_urls" = "Coord_image_urls" - v_full_url
        WHERE "Style_no" = v_style_no;
    END IF;

    RETURN OLD;
END;
$function$;
