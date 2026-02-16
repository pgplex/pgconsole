SELECT
  id,
  name
FROM
  users
WHERE
  active = TRUE
INTERSECT
SELECT
  id,
  name
FROM
  premium_users;
