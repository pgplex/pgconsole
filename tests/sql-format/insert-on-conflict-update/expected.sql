INSERT INTO users (
  id,
  name,
  email
)
VALUES (
  1,
  'John',
  'john@example.com'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email;
