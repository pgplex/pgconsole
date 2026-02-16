SELECT
  region,
  product,
  SUM(sales)
FROM
  orders
GROUP BY
  ROLLUP (region, product);
