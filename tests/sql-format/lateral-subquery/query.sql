SELECT u.name, o.total FROM users u, LATERAL (SELECT SUM(amount) as total FROM orders WHERE user_id = u.id) o
