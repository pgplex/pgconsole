import postgres from "postgres";
import { getConnectionById } from "./config";

export interface ConnectionDetails {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string | undefined;
  sslMode: string;
  lockTimeout?: string;
  statementTimeout?: string;
}

// Map a configured connection to the details needed to open a client.
// Returns null when the connection ID is unknown; callers raise their own error.
export function buildConnectionDetails(connectionId: string): ConnectionDetails | null {
  const conn = getConnectionById(connectionId);
  if (!conn) return null;
  return {
    host: conn.host,
    port: conn.port,
    database: conn.database,
    username: conn.username,
    password: conn.password,
    sslMode: conn.ssl_mode || "prefer",
    lockTimeout: conn.lock_timeout,
    statementTimeout: conn.statement_timeout,
  };
}

export function formatAppName(appUser?: string): string {
  if (!appUser) return "pgconsole";
  // PostgreSQL application_name has a 63 character limit
  const maxUserLen = 63 - "pgconsole/".length;
  const truncated = appUser.length > maxUserLen ? appUser.slice(0, maxUserLen) : appUser;
  return `pgconsole/${truncated}`;
}

export function createClient(details: ConnectionDetails, appUser?: string) {
  return postgres({
    host: details.host,
    port: details.port,
    database: details.database,
    username: details.username,
    password: details.password,
    ssl: details.sslMode === "disable" ? false : details.sslMode,
    connect_timeout: 10,
    max: 1,
    onnotice: () => {},
    connection: {
      application_name: formatAppName(appUser),
      ...(details.lockTimeout && { lock_timeout: details.lockTimeout }),
      ...(details.statementTimeout && { statement_timeout: details.statementTimeout }),
    },
  });
}

export async function withConnection<T>(
  details: ConnectionDetails,
  fn: (sql: ReturnType<typeof postgres>) => Promise<T>,
  appUser?: string
): Promise<T> {
  const client = createClient(details, appUser);

  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
