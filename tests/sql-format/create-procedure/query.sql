CREATE PROCEDURE insert_data(a integer, b integer) LANGUAGE SQL AS $$ INSERT INTO tbl VALUES (a); INSERT INTO tbl VALUES (b); $$
