// Centralized home for cross-cutting and otherwise-duplicated constants.
//
// Keep this file dependency-free (pure values only) so both the client and the
// server can import it without dragging browser- or server-only code across the
// boundary. Feature-local constants that are used in exactly one place and are
// already well-named should stay next to their feature — only values that are
// duplicated, span the client/server boundary, or define a runtime contract
// belong here.

// --- Audit log ---

/**
 * Max audit-log rows fetched per tab, and the server-side hard clamp on the
 * `limit` request field. The client request and the server clamp must agree, so
 * they share this single source of truth.
 */
export const AUDIT_LOG_FETCH_LIMIT = 1000

/** Server default applied when an audit-log request omits a positive `limit`. */
export const AUDIT_LOG_DEFAULT_LIMIT = 100

// --- Live polling ---

/**
 * Refetch cadence (ms) for client queries that poll live data — active sessions
 * and the audit-log tabs.
 */
export const LIVE_QUERY_REFETCH_INTERVAL_MS = 5000

// --- MCP server ---

/**
 * Hard cap on rows an MCP execution tool returns. The full result is fetched,
 * then capped; when capped the response sets `truncated` so the agent can narrow.
 */
export const MCP_MAX_RESULT_ROWS = 1000

/** Page size for MCP catalog browsing (`list_objects` pagination). */
export const MCP_CATALOG_PAGE_SIZE = 100
