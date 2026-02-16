SELECT id, name, ROW_NUMBER() OVER (PARTITION BY department ORDER BY created_at DESC) AS rn FROM employees
