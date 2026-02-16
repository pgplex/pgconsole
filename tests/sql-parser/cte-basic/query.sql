WITH active_users AS (
  SELECT * FROM users WHERE active = true
)
SELECT * FROM active_users