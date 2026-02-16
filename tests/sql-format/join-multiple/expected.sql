SELECT
  u.name,
  o.total,
  p.name AS product
FROM
  users u
INNER JOIN
  orders o ON u.id = o.user_id
INNER JOIN
  products p ON o.product_id = p.id;
