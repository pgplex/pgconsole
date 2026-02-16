SELECT u.name, o.total FROM users u RIGHT JOIN orders o ON u.id = o.user_id
