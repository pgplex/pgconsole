CREATE FUNCTION get_stats(
  tbl text,
  OUT min_val int4,
  OUT max_val int4
)
LANGUAGE plpgsql
SECURITY DEFINER
COST 100
AS $$
 BEGIN SELECT MIN(value), MAX(value) INTO min_val, max_val FROM stats WHERE table_name = tbl; END; 
$$;
