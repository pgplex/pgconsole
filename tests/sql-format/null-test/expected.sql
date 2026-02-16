SELECT
  *
FROM
  users
WHERE
  email IS NOT NULL
  AND deleted_at IS NULL;
