SELECT
  *
FROM
  orders
WHERE
  status = 'pending'
FOR SHARE;
