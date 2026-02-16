# API Testing with Hurl

Tests for the ConnectRPC organization service.

## Setup

1. **Copy environment template**
   ```bash
   cp tests/.env.example tests/.env
   ```

2. **Create a test user and update credentials**
   - The `.env.example` contains placeholder values
   - Create a test user in your database (via signup API or database directly)
   - Update `tests/.env` with:
     - `TEST_EMAIL`: The user's email
     - `TEST_PASSWORD`: The user's password
     - `TEST_USER_ID`: The user's ID from the database

   **Example for local development:**
   - Default test credentials: `test@example.com` / `test_password_123`
   - Find the user ID in your database and update `TEST_USER_ID`

## Running Tests

```bash
# Start server first
pnpm dev:server

# Run tests
pnpm test:api
```

## What's Tested

**Organization CRUD** (`tests/api/orgs.hurl`)
- Authentication
- List/Create/Get/Update/Delete operations

## Troubleshooting

- **"Properties file does not exist"**: Copy `tests/.env.example` to `tests/.env`
- **404 errors**: Make sure server is running on port 9876
- **Auth failed**: Verify credentials in `tests/.env` match database
