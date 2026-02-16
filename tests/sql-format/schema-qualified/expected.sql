SELECT
  *
FROM
  public.users u
INNER JOIN
  auth.sessions s ON u.id = s.user_id;
