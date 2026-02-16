import { ConnectError, Code } from '@connectrpc/connect'
import { getIAMRules, getGroupsForUser, isAuthEnabled, getPlan } from './config'
import { feature } from '../../src/lib/plan'
import type { Permission } from './config'

export type { Permission }

const ALL_PERMISSIONS: Permission[] = ['read', 'write', 'ddl', 'admin', 'explain', 'execute', 'export']

/**
 * Throws if user lacks the specified permission for a connection.
 */
export function requirePermission(
  user: { email: string } | null,
  connectionId: string,
  permission: Permission,
  action: string
): void {
  if (!user) {
    throw new ConnectError('Authentication required', Code.Unauthenticated)
  }
  if (!hasPermission(user.email, connectionId, permission)) {
    throw new ConnectError(`Permission denied: ${action} requires '${permission}' permission`, Code.PermissionDenied)
  }
}

/**
 * Throws if user lacks any of the specified permissions for a connection.
 */
export function requirePermissions(
  user: { email: string } | null,
  connectionId: string,
  permissions: Set<Permission>,
  action: string
): void {
  if (!user) {
    throw new ConnectError('Authentication required', Code.Unauthenticated)
  }
  const userPerms = getUserPermissions(user.email, connectionId)
  const missing = [...permissions].filter(p => !userPerms.has(p))
  if (missing.length > 0) {
    throw new ConnectError(`Permission denied: ${action} requires '${missing.join("', '")}' permission`, Code.PermissionDenied)
  }
}

/**
 * Throws if user has no permissions at all for a connection.
 * Returns the user's permissions if they have access.
 * Returns NotFound to avoid revealing connection existence.
 */
export function requireAnyPermission(
  user: { email: string } | null,
  connectionId: string
): Set<Permission> {
  if (!user) {
    throw new ConnectError('Authentication required', Code.Unauthenticated)
  }
  const perms = getUserPermissions(user.email, connectionId)
  if (perms.size === 0) {
    throw new ConnectError('Connection not found', Code.NotFound)
  }
  return perms
}

/**
 * Get all permissions a user has for a specific connection.
 * Returns a Set of permissions (union of all matching rules).
 */
export function getUserPermissions(email: string, connectionId: string): Set<Permission> {
  // If auth is disabled, grant full access
  if (!isAuthEnabled()) {
    return new Set(ALL_PERMISSIONS)
  }

  // If IAM is not enabled by plan, grant full access to authenticated users
  if (!feature('IAM', getPlan())) {
    return new Set(ALL_PERMISSIONS)
  }

  const rules = getIAMRules()
  const userGroups = getGroupsForUser(email)
  const groupIds = new Set(userGroups.map(g => g.id))

  const permissions = new Set<Permission>()

  for (const rule of rules) {
    // Check if rule applies to this connection
    if (rule.connection !== '*' && rule.connection !== connectionId) {
      continue
    }

    // Check if user matches any member
    const matches = rule.members.some(member => {
      if (member === '*') {
        return true
      }
      if (member.startsWith('user:')) {
        return member.slice(5) === email
      }
      if (member.startsWith('group:')) {
        return groupIds.has(member.slice(6))
      }
      return false
    })

    if (matches) {
      for (const perm of rule.permissions) {
        permissions.add(perm)
      }
    }
  }

  return permissions
}

/**
 * Check if a user has a specific permission for a connection.
 */
export function hasPermission(email: string, connectionId: string, permission: Permission): boolean {
  return getUserPermissions(email, connectionId).has(permission)
}

/**
 * Get all connection IDs that a user has at least one permission for.
 * Used to filter the connection list.
 */
export function getAccessibleConnectionIds(email: string, allConnectionIds: string[]): string[] {
  // If auth is disabled, all connections are accessible
  if (!isAuthEnabled()) {
    return allConnectionIds
  }

  return allConnectionIds.filter(connId => {
    const perms = getUserPermissions(email, connId)
    return perms.size > 0
  })
}
