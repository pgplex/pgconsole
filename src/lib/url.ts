import type { ObjectType } from '@/components/sql-editor/ObjectTree'

export interface EditorUrlParams {
  connectionId: string
  schema?: string
  object?: {
    name: string
    type: ObjectType
    arguments?: string
  }
}

/**
 * Build URL search params for the SQL editor.
 *
 * Examples:
 * - buildEditorUrl({ connectionId: 'local' })
 *   → ?connectionId=local
 * - buildEditorUrl({ connectionId: 'local', schema: 'public', object: { name: 'users', type: 'table' } })
 *   → ?connectionId=local&schema=public&table=users
 * - buildEditorUrl({ connectionId: 'local', schema: 'public', object: { name: 'get_user', type: 'function', arguments: 'integer' } })
 *   → ?connectionId=local&schema=public&function=get_user(integer)
 */
export function buildEditorSearchParams(params: EditorUrlParams): URLSearchParams {
  const searchParams = new URLSearchParams()

  searchParams.set('connectionId', params.connectionId)

  if (params.schema) {
    searchParams.set('schema', params.schema)
  }

  if (params.object) {
    const value = params.object.arguments
      ? `${params.object.name}(${params.object.arguments})`
      : params.object.name
    searchParams.set(params.object.type, value)
  }

  return searchParams
}

/**
 * Build full URL path for the SQL editor.
 */
export function buildEditorUrl(params: EditorUrlParams): string {
  return `/?${buildEditorSearchParams(params).toString()}`
}

const OBJECT_TYPES: ObjectType[] = ['table', 'view', 'materialized_view', 'function', 'procedure']

/**
 * Parse object from URL search params.
 * Returns null if no object type param is found.
 */
export function parseObjectFromUrl(searchParams: URLSearchParams): {
  name: string
  type: ObjectType
  arguments?: string
} | null {
  for (const type of OBJECT_TYPES) {
    const value = searchParams.get(type)
    if (value) {
      // Parse name and args from value like "func_name(arg1, arg2)"
      const match = value.match(/^([^(]+)(?:\(([^)]*)\))?$/)
      if (match) {
        return {
          name: match[1],
          type,
          arguments: match[2], // undefined if no parens
        }
      }
      return { name: value, type }
    }
  }

  return null
}

/**
 * Update object params on existing URLSearchParams (mutates in place).
 * Clears all object type params, then sets the new one if provided.
 */
export function setObjectParams(
  searchParams: URLSearchParams,
  object: { name: string; type: ObjectType; arguments?: string } | null
): void {
  // Clear all object type params
  for (const type of OBJECT_TYPES) {
    searchParams.delete(type)
  }

  // Set new object param if provided
  if (object) {
    const value = object.arguments
      ? `${object.name}(${object.arguments})`
      : object.name
    searchParams.set(object.type, value)
  }
}
