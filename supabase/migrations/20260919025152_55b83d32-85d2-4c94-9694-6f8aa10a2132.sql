CREATE OR REPLACE FUNCTION public.norm_phone(_v text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d text;
BEGIN
  d := regexp_replace(COALESCE(_v,''), '\D', '', 'g');
  IF length(d) >= 12 AND left(d,2) = '55' THEN d := substr(d,3); END IF;
  IF length(d) < 10 THEN RETURN NULL; END IF;
  RETURN left(d, 2) || right(d, 8);
END; $$;
