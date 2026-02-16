SELECT COUNT(DISTINCT status), MAX(created_at), COALESCE(name, 'Unknown') FROM users
