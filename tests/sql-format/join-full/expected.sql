SELECT
  u.name,
  o.total
FROM
  users u
FULL JOIN
  orders o ON u.id = o.user_id;
