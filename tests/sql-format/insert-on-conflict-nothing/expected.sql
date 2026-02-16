INSERT INTO products (
  sku,
  name
)
VALUES (
  'ABC123',
  'Widget'
)
ON CONFLICT DO NOTHING;
