SELECT
  id,
  CASE
  WHEN status = 'active' THEN 'Active'
  WHEN status = 'pending' THEN 'Pending'
  ELSE 'Unknown'
END AS status_label
FROM
  users;
