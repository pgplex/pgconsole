SELECT
  *
FROM
  (
  SELECT
    id,
    name
  FROM
    users
  WHERE
    active = TRUE
) active_users;
