SELECT
  u.name,
  o.total
FROM
  users u
LEFT JOIN
  orders o ON u.id = o.user_id;
