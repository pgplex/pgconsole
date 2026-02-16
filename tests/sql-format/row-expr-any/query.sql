SELECT e.emp_no, e.first_name, s.amount FROM employee e INNER JOIN salary s ON e.emp_no = s.emp_no WHERE (e.emp_no, s.amount) = ANY (SELECT emp_no, MAX(amount) FROM salary GROUP BY emp_no)
