CREATE OR REPLACE FUNCTION public.calculate_total(
  price numeric,
  quantity int4 DEFAULT 1
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
 BEGIN RETURN price * quantity; END; 
$$;
