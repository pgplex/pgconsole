SELECT department, COUNT(*) FILTER (WHERE active = true) AS active_count FROM employees GROUP BY department
