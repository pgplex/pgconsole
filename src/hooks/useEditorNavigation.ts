import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { parseObjectFromUrl, setObjectParams } from '@/lib/url'
import { useSchemas, useTables } from './useQuery'
import type { ObjectType } from '@/components/sql-editor/ObjectTree'

export interface SelectedObject {
  schema: string
  name: string
  type: ObjectType
  arguments?: string
}

interface UseEditorNavigationResult {
  // Resolved state (with defaults applied)
  schema: string | null
  object: SelectedObject | null
  // Loading states
  isLoading: boolean
  isSchemasLoading: boolean
  isTablesLoading: boolean
  // Error states
  schemasError: Error | null
  tablesError: Error | null
  // Available data
  schemas: string[]
  tables: Array<{ name: string; type: string }>
  // Setters for user interactions
  setSchema: (schema: string | null) => void
  setObject: (object: SelectedObject | null, options?: { replace?: boolean }) => void
}

export function useEditorNavigation(connectionId: string): UseEditorNavigationResult {
  const [searchParams, setSearchParams] = useSearchParams()
  const prevConnectionIdRef = useRef<string | null>(null)

  // Parse current URL state
  const schemaFromUrl = searchParams.get('schema')
  const objectFromUrl = parseObjectFromUrl(searchParams)

  // Fetch schemas for this connection
  const {
    data: schemas = [],
    isLoading: isSchemasLoading,
    error: schemasError,
  } = useSchemas(connectionId)

  // Determine the effective schema (from URL or default)
  const effectiveSchema = schemaFromUrl && schemas.includes(schemaFromUrl)
    ? schemaFromUrl
    : schemas.length > 0
      ? (schemas.includes('public') ? 'public' : schemas[0])
      : null

  // Fetch tables for the effective schema
  const {
    data: tables = [],
    isLoading: isTablesLoading,
    error: tablesError,
  } = useTables(connectionId, effectiveSchema || '')

  // Determine the effective object (from URL or default)
  const effectiveObject: SelectedObject | null = (() => {
    if (!effectiveSchema) return null

    // If URL has an object, use it
    // For functions/procedures, trust the URL (they're not in tables list)
    // For tables/views, validate they exist
    if (objectFromUrl) {
      const isFunction = objectFromUrl.type === 'function' || objectFromUrl.type === 'procedure'
      if (isFunction) {
        // Functions/procedures are valid - trust the URL
        return {
          schema: effectiveSchema,
          name: objectFromUrl.name,
          type: objectFromUrl.type,
          arguments: objectFromUrl.arguments,
        }
      }
      // For tables/views, check if it exists
      const exists = tables.some(t => t.name === objectFromUrl.name)
      if (exists) {
        return {
          schema: effectiveSchema,
          name: objectFromUrl.name,
          type: objectFromUrl.type,
          arguments: objectFromUrl.arguments,
        }
      }
    }

    // Default to first table or view (only if no valid object in URL)
    if (tables.length > 0) {
      const firstTable = tables.find(t => t.type === 'table') || tables[0]
      return {
        schema: effectiveSchema,
        name: firstTable.name,
        type: firstTable.type === 'view' ? 'view' : 'table',
      }
    }

    return null
  })()

  // Update URL when resolved state differs from URL state
  useEffect(() => {
    // Don't update URL while still loading
    if (!connectionId || isSchemasLoading) return

    // Detect connection change - clear URL params
    const connectionChanged = prevConnectionIdRef.current !== null &&
                              prevConnectionIdRef.current !== connectionId
    prevConnectionIdRef.current = connectionId

    if (connectionChanged) {
      // Connection changed - navigate to clean URL, let next render set defaults
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams()
          newParams.set('connectionId', prev.get('connectionId') || connectionId)
          return newParams
        },
        { replace: true }
      )
      return
    }

    // Check if schema needs updating
    const needsSchemaUpdate = effectiveSchema && effectiveSchema !== schemaFromUrl

    // Check if object needs updating (only after tables are loaded)
    const needsObjectUpdate = !isTablesLoading && effectiveObject && (
      !objectFromUrl ||
      objectFromUrl.name !== effectiveObject.name ||
      objectFromUrl.type !== effectiveObject.type
    )

    if (needsSchemaUpdate || needsObjectUpdate) {
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev)

          if (needsSchemaUpdate && effectiveSchema) {
            newParams.set('schema', effectiveSchema)
          }

          if (needsObjectUpdate) {
            setObjectParams(newParams, effectiveObject)
          }

          return newParams
        },
        { replace: true }
      )
    }
  }, [
    connectionId,
    isSchemasLoading,
    isTablesLoading,
    effectiveSchema,
    schemaFromUrl,
    effectiveObject,
    objectFromUrl,
    setSearchParams,
  ])

  // Setters for user interactions
  const setSchema = useCallback(
    (schema: string | null) => {
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev)
          if (schema) {
            newParams.set('schema', schema)
          } else {
            newParams.delete('schema')
          }
          // Clear object when schema changes
          setObjectParams(newParams, null)
          return newParams
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const setObject = useCallback(
    (object: SelectedObject | null, options?: { replace?: boolean }) => {
      setSearchParams(
        (prev) => {
          const newParams = new URLSearchParams(prev)
          setObjectParams(newParams, object)
          return newParams
        },
        { replace: options?.replace ?? true }
      )
    },
    [setSearchParams]
  )

  return {
    schema: effectiveSchema,
    object: effectiveObject,
    isLoading: isSchemasLoading || isTablesLoading,
    isSchemasLoading,
    isTablesLoading,
    schemasError: schemasError as Error | null,
    tablesError: tablesError as Error | null,
    schemas,
    tables,
    setSchema,
    setObject,
  }
}
