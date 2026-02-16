import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSchemas, queryKeys } from './useQuery'
import { schemaStore } from '../lib/schema-store'

export function useSchemaStoreSync(connectionId: string, selectedSchema: string | null) {
  const queryClient = useQueryClient()

  // Sync connection ID
  useEffect(() => {
    schemaStore.setConnection(connectionId)
  }, [connectionId])

  // Sync selected schema
  useEffect(() => {
    if (selectedSchema) {
      schemaStore.setSelectedSchema(selectedSchema)
    }
  }, [selectedSchema])

  // Fetch and sync schemas
  const { data: schemas } = useSchemas(connectionId)

  useEffect(() => {
    if (schemas && schemas.length > 0) {
      schemaStore.setSchemas(schemas)

      // Pre-fetch tables, functions, and procedures for all schemas
      for (const schema of schemas) {
        queryClient.prefetchQuery({
          queryKey: queryKeys.tables(connectionId, schema),
        })
        queryClient.prefetchQuery({
          queryKey: queryKeys.functions(connectionId, schema),
        })
        queryClient.prefetchQuery({
          queryKey: queryKeys.procedures(connectionId, schema),
        })
      }
    }
  }, [schemas, connectionId, queryClient])

  // Sync tables, functions, and procedures as they load
  useEffect(() => {
    if (!schemas) return

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.state.status === 'success') {
        const queryKey = event.query.queryKey as string[]

        // Check if this is a tables query
        if (queryKey[1] === 'tables' && queryKey[2] === connectionId) {
          const schema = queryKey[3] as string
          const tables = event.query.state.data as Array<{ name: string; type: string }>
          if (tables) {
            schemaStore.setTables(schema, tables)
            if (tables.length > 0) {
              schemaStore.setLoaded(true)
            }
          }
        }

        // Check if this is a functions query
        if (queryKey[1] === 'functions' && queryKey[2] === connectionId) {
          const schema = queryKey[3] as string
          const functions = event.query.state.data as Array<{ name: string; arguments: string; returnType: string }>
          if (functions) {
            schemaStore.setFunctions(schema, functions, 'function')
          }
        }

        // Check if this is a procedures query
        if (queryKey[1] === 'procedures' && queryKey[2] === connectionId) {
          const schema = queryKey[3] as string
          const procedures = event.query.state.data as Array<{ name: string; arguments: string }>
          if (procedures) {
            schemaStore.setFunctions(schema, procedures, 'procedure')
          }
        }

        // Check if this is a columns query
        if (queryKey[1] === 'columns' && queryKey[2] === connectionId) {
          const schema = queryKey[3] as string
          const table = queryKey[4] as string
          const columns = event.query.state.data as Array<{ name: string; type: string; nullable: boolean }>
          if (columns) {
            schemaStore.setColumns(schema, table, columns)
          }
        }
      }
    })

    return () => unsubscribe()
  }, [schemas, connectionId, queryClient])

}
