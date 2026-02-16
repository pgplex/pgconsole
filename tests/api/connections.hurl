# Connection API Tests
# Tests for connection.v1.ConnectionService read operations
# (Connections are configured via pgconsole.toml, not via API)
#
# Run: pnpm test:api

# ============================================================
# 1. AUTHENTICATE
# ============================================================
POST http://localhost:9876/api/auth/login
Content-Type: application/json
{
  "email": "test@example.com",
  "password": "testpassword"
}

HTTP 200
[Captures]
session_cookie: header "set-cookie" regex "pgconsole_token=([^;]+)"

# ============================================================
# 2. LIST CONNECTIONS
# ============================================================
POST http://localhost:9876/connection.v1.ConnectionService/ListConnections
Content-Type: application/json
Cookie: pgconsole_token={{session_cookie}}
{}

HTTP 200

# ============================================================
# 3. GET CONNECTION
# ============================================================
POST http://localhost:9876/connection.v1.ConnectionService/GetConnection
Content-Type: application/json
Cookie: pgconsole_token={{session_cookie}}
{
  "id": "test-conn"
}

HTTP 200
[Asserts]
jsonpath "$.connection.id" == "test-conn"
jsonpath "$.connection.name" == "Test Connection"
jsonpath "$.connection.host" == "localhost"
jsonpath "$.connection.port" == 5432
jsonpath "$.connection.database" == "postgres"
