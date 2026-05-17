import { useQuery, useMutation } from '@tanstack/react-query'
import { migrationClient } from '@/lib/connect-client'

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
      return results
    },
  })
}
