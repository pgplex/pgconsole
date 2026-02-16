SELECT
  *
FROM
  orders
INNER JOIN
  customers USING (customer_id);
