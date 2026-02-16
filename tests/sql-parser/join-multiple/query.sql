SELECT * FROM orders o
INNER JOIN users u ON o.user_id = u.id
LEFT JOIN addresses a ON u.address_id = a.id