import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { migrationClient, metadataClient } from '@/lib/connect-client'
import { ConnectError } from '@connectrpc/connect'

export function useSchemaSourceStatus(connectionId: string) {
  return useQuery({
    queryKey: ['migration', 'schema-source-status', connectionId],
    queryFn: () => migrationClient.getSchemaSourceStatus({ connectionId }),
    enabled: !!connectionId,
  })
}

export function usePlanMigration() {
  return useMutation({
    mutationFn: (connectionId: string) =>
      migrationClient.planMigration({ connectionId }),
  })
}

export function useMetadataTableStatus(connectionId: string) {
  return useQuery({
    queryKey: ['metadata', 'table-status', connectionId],
    queryFn: async () => {
      try {
        await metadataClient.listMetadata({ connectionId, prefix: '' })
        return { initialized: true }
      } catch (err) {
        if (err instanceof ConnectError && err.code === 9 /* FailedPrecondition */) {
          return { initialized: false }
        }
        throw err
      }
    },
    enabled: !!connectionId,
  })
}

export function useInitMetadataTable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (connectionId: string) =>
      metadataClient.initMetadataTable({ connectionId }),
    onSuccess: (_, connectionId) => {
      qc.invalidateQueries({ queryKey: ['metadata', 'table-status', connectionId] })
    },
  })
}

export function useSetSchemaSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ connectionId, source }: { connectionId: string; source: { repo: string; branch: string; path: string; schema: string } }) =>
      metadataClient.setMetadata({
        connectionId,
        key: 'schema_source',
        value: JSON.stringify(source),
      }),
    onSuccess: (_, { connectionId }) => {
      qc.invalidateQueries({ queryKey: ['migration', 'schema-source-status', connectionId] })
    },
  })
}

export function useApplyMigration() {
  return useMutation({
    mutationFn: async (
      params: { connectionId: string; planId: string },
    ) => {
      const results: Array<{ step: number; totalSteps: number; sql: string; status: string; error: string }> = []
      for await (const response of migrationClient.applyMigration(params)) {
        results.push({
          step: response.step,
          totalSteps: response.totalSteps,
          sql: response.sql,
          status: response.status,
          error: response.error,
        })
      }
      const failed = results.find(r => r.status === 'failed')
      if (failed) {
        throw new Error(failed.error || 'Migration apply failed')
      }
      return results
    },
  })
}
