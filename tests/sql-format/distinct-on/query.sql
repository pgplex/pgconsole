SELECT DISTINCT ON (user_id) user_id, order_id, created_at FROM orders ORDER BY user_id, created_at DESC
