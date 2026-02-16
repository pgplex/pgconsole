SELECT region, product, SUM(sales) FROM orders GROUP BY GROUPING SETS ((region), (product), ())
