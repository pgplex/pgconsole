SELECT
  id
FROM
  orders
INTERSECT ALL
SELECT
  id
FROM
  shipments;
