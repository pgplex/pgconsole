SELECT id, amount, SUM(amount) OVER w FROM orders WINDOW w AS (PARTITION BY dept) ORDER BY id
