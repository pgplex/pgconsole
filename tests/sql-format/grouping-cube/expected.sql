SELECT
  region,
  product,
  SUM(sales)
FROM
  orders
GROUP BY
  CUBE (region, product);
