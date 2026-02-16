CREATE PROCEDURE insert_data(
  a int4,
  b int4
)
LANGUAGE sql
AS $$
 INSERT INTO tbl VALUES (a); INSERT INTO tbl VALUES (b); 
$$;
