import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryClient, connectionClient, aiClient } from '../lib/connect-client';
import type { ColumnMetadata } from '../components/sql-editor/hooks/useEditorTabs';

// Query keys
export const queryKeys = {
  all: ['query'] as const,
  schemas: (connectionId: string) => [...queryKeys.all, 'schemas', connectionId] as const,
  tables: (connectionId: string, schema: string) => [...queryKeys.all, 'tables', connectionId, schema] as const,
  columns: (connectionId: string, schema: string, table: string) => [...queryKeys.all, 'columns', connectionId, schema, table] as const,
  tableInfo: (connectionId: string, schema: string, table: string) => [...queryKeys.all, 'tableInfo', connectionId, schema, table] as const,
  indexes: (connectionId: string, schema: string, table: string) => [...queryKeys.all, 'indexes', connectionId, schema, table] as const,
  constraints: (connectionId: string, schema: string, table: string) => [...queryKeys.all, 'constraints', connectionId, schema, table] as const,
  triggers: (connectionId: string, schema: string, table: string) => [...queryKeys.all, 'triggers', connectionId, schema, table] as const,
  policies: (connectionId: string, schema: string, table: string) => [...queryKeys.all, 'policies', connectionId, schema, table] as const,
  grants: (connectionId: string, schema: string, table: string) => [...queryKeys.all, 'grants', connectionId, schema, table] as const,
  materializedViews: (connectionId: string, schema: string) => [...queryKeys.all, 'materializedViews', connectionId, schema] as const,
  functions: (connectionId: string, schema: string) => [...queryKeys.all, 'functions', connectionId, schema] as const,
  procedures: (connectionId: string, schema: string) => [...queryKeys.all, 'procedures', connectionId, schema] as const,
  functionInfo: (connectionId: string, schema: string, name: string, args?: string) => [...queryKeys.all, 'functionInfo', connectionId, schema, name, args] as const,
  functionDependencies: (connectionId: string, schema: string, name: string, args?: string) => [...queryKeys.all, 'functionDependencies', connectionId, schema, name, args] as const,
  processes: (connectionId: string) => [...queryKeys.all, 'processes', connectionId] as const,
};

export const connectionKeys = {
  all: ['connections'] as const,
  list: () => [...connectionKeys.all, 'list'] as const,
  detail: (id: string) => [...connectionKeys.all, 'detail', id] as const,
};

// Get schemas for a connection
export function useSchemas(connectionId: string) {
  return useQuery({
    queryKey: queryKeys.schemas(connectionId),
    queryFn: async () => {
      const response = await queryClient.getSchemas({ connectionId });
      return response.schemas;
    },
    enabled: !!connectionId,
  });
}

// Get tables for a schema
export function useTables(connectionId: string, schema: string) {
  return useQuery({
    queryKey: queryKeys.tables(connectionId, schema),
    queryFn: async () => {
      const response = await queryClient.getTables({ connectionId, schema });
      return response.tables;
    },
    enabled: !!connectionId && !!schema,
  });
}

// Get columns for a table
export function useColumns(connectionId: string, schema: string, table: string) {
  return useQuery({
    queryKey: queryKeys.columns(connectionId, schema, table),
    queryFn: async () => {
      const response = await queryClient.getColumns({ connectionId, schema, table });
      return response.columns;
    },
    enabled: !!connectionId && !!schema && !!table,
  });
}

// Get table metadata (owner, size, encoding, collation, etc.)
export function useTableInfo(connectionId: string, schema: string, table: string) {
  return useQuery({
    queryKey: queryKeys.tableInfo(connectionId, schema, table),
    queryFn: async () => {
      const response = await queryClient.getTableInfo({ connectionId, schema, table });
      return response.metadata;
    },
    enabled: !!connectionId && !!schema && !!table,
  });
}

// Get indexes for a table
export function useIndexes(connectionId: string, schema: string, table: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.indexes(connectionId, schema, table),
    queryFn: async () => {
      const response = await queryClient.getIndexes({ connectionId, schema, table });
      return response.indexes;
    },
    enabled: enabled && !!connectionId && !!schema && !!table,
  });
}

// Get constraints for a table (includes reverse FKs in referencedBy)
export function useConstraints(connectionId: string, schema: string, table: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.constraints(connectionId, schema, table),
    queryFn: async () => {
      const response = await queryClient.getConstraints({ connectionId, schema, table });
      return { constraints: response.constraints, referencedBy: response.referencedBy };
    },
    enabled: enabled && !!connectionId && !!schema && !!table,
  });
}

// Get triggers for a table
export function useTriggers(connectionId: string, schema: string, table: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.triggers(connectionId, schema, table),
    queryFn: async () => {
      const response = await queryClient.getTriggers({ connectionId, schema, table });
      return response.triggers;
    },
    enabled: enabled && !!connectionId && !!schema && !!table,
  });
}

// Get policies for a table
export function usePolicies(connectionId: string, schema: string, table: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.policies(connectionId, schema, table),
    queryFn: async () => {
      const response = await queryClient.getPolicies({ connectionId, schema, table });
      return response.policies;
    },
    enabled: enabled && !!connectionId && !!schema && !!table,
  });
}

// Get grants for a table
export function useGrants(connectionId: string, schema: string, table: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.grants(connectionId, schema, table),
    queryFn: async () => {
      const response = await queryClient.getGrants({ connectionId, schema, table });
      return response.grants;
    },
    enabled: enabled && !!connectionId && !!schema && !!table,
  });
}

// Get materialized views for a schema
export function useMaterializedViews(connectionId: string, schema: string) {
  return useQuery({
    queryKey: queryKeys.materializedViews(connectionId, schema),
    queryFn: async () => {
      const response = await queryClient.getMaterializedViews({ connectionId, schema });
      return response.materializedViews;
    },
    enabled: !!connectionId && !!schema,
  });
}

// Get functions for a schema
export function useFunctions(connectionId: string, schema: string) {
  return useQuery({
    queryKey: queryKeys.functions(connectionId, schema),
    queryFn: async () => {
      const response = await queryClient.getFunctions({ connectionId, schema });
      return response.functions;
    },
    enabled: !!connectionId && !!schema,
  });
}

// Get procedures for a schema
export function useProcedures(connectionId: string, schema: string) {
  return useQuery({
    queryKey: queryKeys.procedures(connectionId, schema),
    queryFn: async () => {
      const response = await queryClient.getProcedures({ connectionId, schema });
      return response.procedures;
    },
    enabled: !!connectionId && !!schema,
  });
}

// Get function/procedure info (detailed metadata + definition)
export function useFunctionInfo(connectionId: string, schema: string, name: string, args?: string) {
  return useQuery({
    queryKey: queryKeys.functionInfo(connectionId, schema, name, args),
    queryFn: async () => {
      const response = await queryClient.getFunctionInfo({ connectionId, schema, name, arguments: args });
      return response.metadata;
    },
    enabled: !!connectionId && !!schema && !!name,
  });
}

// Get function/procedure dependencies
export function useFunctionDependencies(connectionId: string, schema: string, name: string, args?: string) {
  return useQuery({
    queryKey: queryKeys.functionDependencies(connectionId, schema, name, args),
    queryFn: async () => {
      const response = await queryClient.getFunctionDependencies({ connectionId, schema, name, arguments: args });
      return response.dependencies;
    },
    enabled: !!connectionId && !!schema && !!name,
  });
}

// Execute SQL (streaming - first message has PID, last has results)
export function useExecuteSQL() {
  return useMutation({
    mutationFn: async ({
      connectionId,
      sql,
      queryId,
      searchPath,
      onPid,
    }: {
      connectionId: string
      sql: string
      queryId?: string
      searchPath?: string  // PostgreSQL search_path (e.g., "myschema, public")
      onPid?: (pid: number) => void
    }) => {
      let lastResponse: {
        columns: ColumnMetadata[]
        rows: Record<string, unknown>[]
        rowCount: number
        executionTime: number
        error: string
        backendPid: number
      } | null = null;

      // Iterate over the stream
      for await (const response of queryClient.executeSQL({ connectionId, sql, queryId, searchPath })) {
        // First message contains just the PID
        if (response.backendPid && onPid && response.columns.length === 0 && !response.error) {
          onPid(response.backendPid);
        }

        // Map the response
        const mappedRows = response.rows.map(row => {
          const obj: Record<string, unknown> = {};
          response.columns.forEach((col, i) => {
            obj[col.name] = row.values[i];
          });
          return obj;
        });

        lastResponse = {
          columns: response.columns.map(col => ({
            name: col.name,
            type: col.type,
            tableName: col.tableName,
            schemaName: col.schemaName,
            isPrimaryKey: col.isPrimaryKey,
            isNullable: col.isNullable,
            hasDefault: col.hasDefault,
          })),
          rows: mappedRows,
          rowCount: response.rowCount,
          executionTime: response.executionTimeMs,
          error: response.error,
          backendPid: response.backendPid,
        };
      }

      if (!lastResponse) {
        throw new Error('No response received from server');
      }

      return lastResponse;
    },
  });
}

// Cancel a running query
export function useCancelQuery() {
  return useMutation({
    mutationFn: async ({ connectionId, queryId }: { connectionId: string; queryId: string }) => {
      const response = await queryClient.cancelQuery({ connectionId, queryId });
      return {
        cancelled: response.cancelled,
        error: response.error,
      };
    },
  });
}

// List connections from config
export function useConnections() {
  return useQuery({
    queryKey: connectionKeys.list(),
    queryFn: async () => {
      const response = await connectionClient.listConnections({});
      return response.connections;
    },
  });
}

// Get active processes for a connection
export function useActiveProcesses(connectionId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.processes(connectionId),
    queryFn: async () => {
      const response = await queryClient.getActiveSessions({ connectionId });
      if (response.error) throw new Error(response.error);
      return response.sessions;
    },
    enabled: enabled && !!connectionId,
    refetchInterval: 5000,
  });
}

// Terminate a process
export function useTerminateProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ connectionId, pid }: { connectionId: string; pid: number }) => {
      const response = await queryClient.terminateSession({ connectionId, pid });
      if (response.error) throw new Error(response.error);
      return response.success;
    },
    onSuccess: (_, { connectionId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.processes(connectionId) });
    },
  });
}

// Refresh AI schema cache
export function useRefreshSchemaCache() {
  return useMutation({
    mutationFn: async ({ connectionId, schemas }: { connectionId: string; schemas?: string[] }) => {
      const response = await aiClient.refreshSchemaCache({
        connectionId,
        schemas: schemas || [],
      });
      if (response.error) throw new Error(response.error);
      return response.success;
    },
  });
}

// Test connection health (returns success/error/latency)
export function useConnectionHealth(connectionId: string, enabled = true) {
  return useQuery({
    queryKey: [...connectionKeys.all, 'health', connectionId],
    queryFn: async () => {
      const response = await connectionClient.testConnection({ id: connectionId });
      return {
        success: response.success,
        error: response.error,
        latencyMs: response.latencyMs,
      };
    },
    enabled: enabled && !!connectionId,
    staleTime: 60000, // Cache for 60 seconds
    retry: 1, // Only retry once on failure
  });
}
