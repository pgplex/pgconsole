import { useConnections } from './useQuery'

/**
 * Hook to check user permissions for a specific connection.
 *
 * All permission gates in the UI should use this hook to ensure
 * consistent permission checking and easy auditing.
 *
 * Permission levels:
 * - read: Query/read-only access
 * - write: INSERT, UPDATE, DELETE operations
 * - ddl: Data Definition Language (CREATE, ALTER, DROP)
 * - admin: Administrative operations (terminate processes, etc.)
 */
export function useConnectionPermissions(connectionId: string) {
  const { data: connections } = useConnections()
  const connection = connections?.find((c) => c.id === connectionId)
  const permissions = connection?.permissions ?? []

  return {
    /** User has read permission */
    hasRead: permissions.includes('read'),
    /** User has write permission (INSERT, UPDATE, DELETE) */
    hasWrite: permissions.includes('write'),
    /** User has DDL permission (CREATE, ALTER, DROP) */
    hasDdl: permissions.includes('ddl'),
    /** User has admin permission (terminate processes, etc.) */
    hasAdmin: permissions.includes('admin'),
    /** User has explain permission (EXPLAIN statements) */
    hasExplain: permissions.includes('explain'),
    /** User has execute permission (CALL stored procedures) */
    hasExecute: permissions.includes('execute'),
    /** User has export permission (CSV export) */
    hasExport: permissions.includes('export'),
    /** All permissions the user has for this connection */
    permissions,
  }
}
