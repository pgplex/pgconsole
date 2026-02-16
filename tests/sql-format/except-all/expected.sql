SELECT
  product_id
FROM
  inventory
EXCEPT ALL
SELECT
  product_id
FROM
  sold_items;
