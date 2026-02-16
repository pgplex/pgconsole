SELECT u.name, o.total, p.name AS product FROM users u JOIN orders o ON u.id = o.user_id JOIN products p ON o.product_id = p.id
