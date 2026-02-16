CREATE FUNCTION get_users(filter_name text) RETURNS TABLE(id integer, name text, email text) LANGUAGE sql STABLE AS $$ SELECT id, name, email FROM users WHERE name LIKE filter_name; $$
