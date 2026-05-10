-- Storage 폴더명(_1, _2)을 DB Style_no(ⓐ, ⓑ)로 역매핑하는 헬퍼 함수
CREATE OR REPLACE FUNCTION public.storage_key_to_style_no(p_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT replace(replace(p_key, '_2', 'ⓑ'), '_1', 'ⓐ');
$$;

-- 이미지 업로드/업데이트 시 동기화 트리거 함수 수정
CREATE OR REPLACE FUNCTION public.handle_product_image_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_storage_key TEXT;
    v_style_no TEXT;
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Storage 폴더명 추출
        v_storage_key := split_part(NEW.name, '/', 1);
        -- DB의 실제 Style_no(ⓐ/ⓑ 원본)로 역매핑
        v_style_no := public.storage_key_to_style_no(v_storage_key);

        UPDATE public.product_information
        SET 
            "Thumbnail_url" = (
                SELECT 'https://akofewiugtsviauyvkkz.supabase.co/storage/v1/object/public/product_image/' || name 
                FROM storage.objects 
                WHERE bucket_id = 'product_image' AND name LIKE v_storage_key || '/thumbnail/%' 
                LIMIT 1
            ),
            "Product_image_urls" = COALESCE((
                SELECT to_jsonb(array_agg('https://akofewiugtsviauyvkkz.supabase.co/storage/v1/object/public/product_image/' || name)) 
                FROM storage.objects 
                WHERE bucket_id = 'product_image' AND name LIKE v_storage_key || '/product/%'
            ), '[]'::jsonb),
            "Coord_image_urls" = COALESCE((
                SELECT to_jsonb(array_agg('https://akofewiugtsviauyvkkz.supabase.co/storage/v1/object/public/product_image/' || name)) 
                FROM storage.objects 
                WHERE bucket_id = 'product_image' AND name LIKE v_storage_key || '/coordi/%'
            ), '[]'::jsonb)
        WHERE "Style_no" = v_style_no;
    END IF;
    RETURN NEW;
END;
$function$;

-- 이미지 삭제 시 동기화 트리거 함수 수정
CREATE OR REPLACE FUNCTION public.handle_product_image_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_storage_key TEXT;
    v_style_no TEXT;
    v_category TEXT;
    v_full_url TEXT;
    v_project_id TEXT := 'akofewiugtsviauyvkkz'; 
    v_bucket_name TEXT := 'product_image';    
BEGIN
    v_storage_key := split_part(OLD.name, '/', 1);
    v_style_no := public.storage_key_to_style_no(v_storage_key);
    v_category := split_part(OLD.name, '/', 2); 
    v_full_url := 'https://' || v_project_id || '.supabase.co/storage/v1/object/public/' || v_bucket_name || '/' || OLD.name;

    IF v_category = 'thumbnail' THEN
        UPDATE public.product_information 
        SET "Thumbnail_url" = NULL 
        WHERE "Style_no" = v_style_no;

    ELSIF v_category = 'product' THEN
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