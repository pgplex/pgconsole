SELECT
  id,
  amount,
  SUM(amount) OVER (ORDER BY date ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS running_total
FROM
  orders;
