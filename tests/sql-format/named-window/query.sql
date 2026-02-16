SELECT id, amount, SUM(amount) OVER w, AVG(amount) OVER w FROM orders WINDOW w AS (ORDER BY date)
