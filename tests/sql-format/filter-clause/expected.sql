SELECT
  department,
  COUNT(*) FILTER (WHERE active = TRUE) AS active_count
FROM
  employees
GROUP BY
  department;
