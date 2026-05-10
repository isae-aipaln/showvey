-- 1) 기존 UNKNOWN_USER / NULL / 빈값 레코드 삭제
DELETE FROM public.evaluations_staff_1 
WHERE "Evaluator_ID" = 'UNKNOWN_USER' OR "Evaluator_ID" IS NULL OR length(trim("Evaluator_ID")) = 0;

DELETE FROM public.evaluations_staff_2 
WHERE "Evaluator_ID" = 'UNKNOWN_USER' OR "Evaluator_ID" IS NULL OR length(trim("Evaluator_ID")) = 0;

DELETE FROM public.evaluations_store 
WHERE "Evaluator_ID" = 'UNKNOWN_USER' OR "Evaluator_ID" IS NULL OR length(trim("Evaluator_ID")) = 0;

-- 2) DB 레벨 CHECK 제약조건 추가 — Evaluator_ID는 NULL/빈문자/UNKNOWN_USER 금지
ALTER TABLE public.evaluations_staff_1 
  ADD CONSTRAINT evaluations_staff_1_evaluator_id_required 
  CHECK ("Evaluator_ID" IS NOT NULL 
     AND length(trim("Evaluator_ID")) > 0 
     AND "Evaluator_ID" <> 'UNKNOWN_USER');

ALTER TABLE public.evaluations_staff_2 
  ADD CONSTRAINT evaluations_staff_2_evaluator_id_required 
  CHECK ("Evaluator_ID" IS NOT NULL 
     AND length(trim("Evaluator_ID")) > 0 
     AND "Evaluator_ID" <> 'UNKNOWN_USER');

ALTER TABLE public.evaluations_store 
  ADD CONSTRAINT evaluations_store_evaluator_id_required 
  CHECK ("Evaluator_ID" IS NOT NULL 
     AND length(trim("Evaluator_ID")) > 0 
     AND "Evaluator_ID" <> 'UNKNOWN_USER');