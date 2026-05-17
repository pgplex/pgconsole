import { useState } from 'react'
import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'
import { GitBranch, Play, RefreshCw, AlertTriangle, CircleCheck } from 'lucide-react'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { ScrollArea } from '../../ui/scroll-area'
import { Spinner } from '../../ui/spinner'
import { usePlanMigration, useApplyMigration } from '../../../hooks/useMigration'
import { useConnectionPermissions } from '../../../hooks/usePermissions'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateSchemaQueries } from '../../../hooks/useQuery'
import type { SchemaDiff } from '@/gen/migration_pb'

interface MigrationPanelProps {
  connectionId: string
}

const operationColor: Record<string, string> = {
  create: 'text-green-700 bg-green-50',
  alter: 'text-blue-700 bg-blue-50',
  drop: 'text-red-700 bg-red-50',
}

const operationIcon: Record<string, string> = {
  create: '+',
  alter: '~',
  drop: '-',
}

function DiffItem({ diff }: { diff: SchemaDiff }) {
  const colorClass = operationColor[diff.operation] || 'text-gray-700 bg-gray-50'
  const icon = operationIcon[diff.operation] || '?'

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 font-mono">
      <span className={`w-4 text-center font-bold ${colorClass.split(' ')[0]}`}>{icon}</span>
      <span className="flex-1 truncate">{diff.path}</span>
      <Badge variant="secondary" size="sm" className={colorClass}>
        {diff.operation.toUpperCase()}
      </Badge>
      <Badge variant="secondary" size="sm">{diff.type}</Badge>
    </div>
  )
}

export function MigrationPanel({ connectionId }: MigrationPanelProps) {
  const { hasDdl } = useConnectionPermissions(connectionId)
  const queryClient = useQueryClient()
  const planMutation = usePlanMigration()
  const applyMutation = useApplyMigration()
  const [showSql, setShowSql] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handlePlan = () => {
    planMutation.mutate(connectionId)
  }

  const handleApply = () => {
    if (!planMutation.data) return
    setConfirmOpen(false)
    applyMutation.mutate(
      { connectionId, planId: planMutation.data.planId },
      {
        onSuccess: () => {
          invalidateSchemaQueries(queryClient, connectionId)
          planMutation.reset()
        },
      },
    )
  }

  if (applyMutation.isPending) {
    return (
      <div className="p-4 flex items-center gap-2 text-sm text-gray-500">
        <Spinner className="size-4" />
        <span>Applying migration...</span>
      </div>
    )
  }

  if (applyMutation.isError) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="size-4" />
          <span>Migration failed</span>
        </div>
        <p className="text-xs text-red-500">{applyMutation.error.message}</p>
        <Button onClick={handlePlan} size="sm" variant="outline">
          <RefreshCw className="size-3.5 mr-1.5" />
          Re-plan
        </Button>
      </div>
    )
  }

  if (applyMutation.isSuccess) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CircleCheck className="size-4" />
          <span>Migration applied successfully</span>
        </div>
        <Button onClick={handlePlan} size="sm" variant="outline">
          <RefreshCw className="size-3.5 mr-1.5" />
          Compare again
        </Button>
      </div>
    )
  }

  if (!planMutation.data && !planMutation.isPending && !planMutation.isError) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <GitBranch className="size-4" />
          <span>Compare current database schema with git source</span>
        </div>
        <Button onClick={handlePlan} size="sm">
          <RefreshCw className="size-3.5 mr-1.5" />
          Compare with Git
        </Button>
      </div>
    )
  }

  if (planMutation.isPending) {
    return (
      <div className="p-4 flex items-center gap-2 text-sm text-gray-500">
        <Spinner className="size-4" />
        <span>Analyzing schema differences...</span>
      </div>
    )
  }

  if (planMutation.isError) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="size-4" />
          <span>Failed to generate plan</span>
        </div>
        <p className="text-xs text-red-500">{planMutation.error.message}</p>
        <Button onClick={handlePlan} size="sm" variant="outline">
          <RefreshCw className="size-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    )
  }

  const plan = planMutation.data!
  const diffs = plan.diffs as SchemaDiff[]

  if (diffs.length === 0) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CircleCheck className="size-4" />
          <span>Schema is up to date with git</span>
        </div>
        <p className="text-xs text-gray-500">
          Branch: {plan.branch} &middot; Commit: {plan.commitHash.slice(0, 7)}
        </p>
        <Button onClick={handlePlan} size="sm" variant="outline">
          <RefreshCw className="size-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-200 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{plan.summary}</span>
          <div className="flex gap-1">
            <Button onClick={handlePlan} size="icon-sm" variant="ghost">
              <RefreshCw className="size-3.5" />
            </Button>
            {hasDdl && (
              <Button size="sm" onClick={() => setConfirmOpen(true)}>
                <Play className="size-3.5 mr-1" />
                Apply
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Branch: {plan.branch} &middot; Commit: {plan.commitHash.slice(0, 7)}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-1">
          {diffs.map((diff, i) => (
            <DiffItem key={`${diff.path}-${i}`} diff={diff} />
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-gray-200">
        <button
          type="button"
          onClick={() => setShowSql(!showSql)}
          className="w-full px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 text-left"
        >
          {showSql ? 'Hide' : 'Show'} DDL ({diffs.length} statement{diffs.length > 1 ? 's' : ''})
        </button>
        {showSql && (
          <div className="px-3 pb-3 max-h-48 overflow-auto">
            <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap">
              {diffs.map(d => d.sql).join('\n\n')}
            </pre>
          </div>
        )}
      </div>

      <AlertDialogPrimitive.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/32 backdrop-blur-sm" />
          <AlertDialogPrimitive.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <AlertDialogPrimitive.Popup className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-lg">
              <AlertDialogPrimitive.Title className="text-lg font-semibold">
                Apply Migration
              </AlertDialogPrimitive.Title>
              <AlertDialogPrimitive.Description className="mt-2 text-sm text-gray-500">
                This will execute {diffs.length} DDL statement{diffs.length > 1 ? 's' : ''} against the database.
                {!plan.canRunInTransaction && (
                  <span className="block mt-2 text-amber-600 font-medium">
                    Warning: Some operations cannot run in a transaction and will be applied individually.
                  </span>
                )}
              </AlertDialogPrimitive.Description>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleApply}>
                  Apply Plan
                </Button>
              </div>
            </AlertDialogPrimitive.Popup>
          </AlertDialogPrimitive.Viewport>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>
    </div>
  )
}
