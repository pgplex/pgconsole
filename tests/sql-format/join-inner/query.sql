SELECT u.name, o.total FROM users u INNER JOIN orders o ON u.id = o.user_id
