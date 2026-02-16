SELECT department, COUNT(*) AS cnt FROM employees GROUP BY department HAVING COUNT(*) > 5
