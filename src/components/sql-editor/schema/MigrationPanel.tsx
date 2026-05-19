import { useState } from 'react'
import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'
import { GitBranch, Play, RefreshCw, AlertTriangle, CircleCheck, Database } from 'lucide-react'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { Input } from '../../ui/input'
import { ScrollArea } from '../../ui/scroll-area'
import { Spinner } from '../../ui/spinner'
import { toastManager } from '../../ui/toast'
import { usePlanMigration, useApplyMigration, useSchemaSourceStatus, useMetadataTableStatus, useInitMetadataTable, useSetSchemaSource } from '../../../hooks/useMigration'
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

type PanelState =
  | { kind: 'idle' }
  | { kind: 'planning' }
  | { kind: 'plan-error'; error: string }
  | { kind: 'up-to-date'; plan: { branch: string; commitHash: string } }
  | { kind: 'has-diffs'; plan: { branch: string; commitHash: string; summary: string; canRunInTransaction: boolean }; diffs: SchemaDiff[] }
  | { kind: 'applying' }
  | { kind: 'apply-error'; error: string }
  | { kind: 'apply-success' }

function derivePanelState(
  planMutation: ReturnType<typeof usePlanMigration>,
  applyMutation: ReturnType<typeof useApplyMigration>,
): PanelState {
  if (applyMutation.isPending) return { kind: 'applying' }
  if (applyMutation.isError) return { kind: 'apply-error', error: applyMutation.error.message }
  if (applyMutation.isSuccess) return { kind: 'apply-success' }
  if (planMutation.isPending) return { kind: 'planning' }
  if (planMutation.isError) return { kind: 'plan-error', error: planMutation.error.message }
  if (planMutation.data) {
    const plan = planMutation.data
    if (plan.diffs.length === 0) return { kind: 'up-to-date', plan }
    return { kind: 'has-diffs', plan, diffs: plan.diffs }
  }
  return { kind: 'idle' }
}

function StatusMessage({ icon, text, className }: { icon: React.ReactNode; text: string; className: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      {icon}
      <span>{text}</span>
    </div>
  )
}

function SchemaSourceSetup({ connectionId }: { connectionId: string }) {
  const { hasAdmin } = useConnectionPermissions(connectionId)
  const tableStatus = useMetadataTableStatus(connectionId)
  const initTable = useInitMetadataTable()
  const setSchemaSource = useSetSchemaSource()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [repo, setRepo] = useState('')
  const [branch, setBranch] = useState('main')
  const [path, setPath] = useState('')
  const [schema, setSchema] = useState('public')

  if (tableStatus.isLoading) {
    return (
      <div className="p-4 flex items-center gap-2 text-sm text-gray-500">
        <Spinner className="size-4" />
        <span>Checking metadata table...</span>
      </div>
    )
  }

  if (!tableStatus.data?.initialized) {
    const handleInit = () => {
      setConfirmOpen(false)
      initTable.mutate(connectionId, {
        onError: (err) => {
          toastManager.add({ type: 'error', title: 'Failed to create metadata table', description: err.message })
        },
      })
    }

    return (
      <div className="p-4 space-y-3">
        <StatusMessage icon={<Database className="size-4" />} text="Metadata table not initialized" className="text-gray-500" />
        <p className="text-xs text-gray-400">
          Migration features require a <code className="bg-gray-100 px-1 rounded">_pgconsole</code> table in your database to store configuration.
        </p>
        {hasAdmin ? (
          <Button onClick={() => setConfirmOpen(true)} size="sm" disabled={initTable.isPending}>
            {initTable.isPending ? <><Spinner className="size-3.5 mr-1.5" /> Initializing...</> : 'Initialize'}
          </Button>
        ) : (
          <p className="text-xs text-amber-600">Admin permission required to initialize.</p>
        )}

        <AlertDialogPrimitive.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogPrimitive.Portal>
            <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/32 backdrop-blur-sm" />
            <AlertDialogPrimitive.Viewport className="fixed inset-0 z-[60] grid place-items-center p-4">
              <AlertDialogPrimitive.Popup className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-lg">
                <AlertDialogPrimitive.Title className="text-lg font-semibold">
                  Create Metadata Table
                </AlertDialogPrimitive.Title>
                <AlertDialogPrimitive.Description className="mt-2 text-sm text-gray-500">
                  This will create a <code className="bg-gray-100 px-1 rounded">_pgconsole</code> table in your database to store pgconsole configuration. Continue?
                </AlertDialogPrimitive.Description>
                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                  <Button onClick={handleInit}>Create Table</Button>
                </div>
              </AlertDialogPrimitive.Popup>
            </AlertDialogPrimitive.Viewport>
          </AlertDialogPrimitive.Portal>
        </AlertDialogPrimitive.Root>
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!repo.trim() || !path.trim()) return
    setSchemaSource.mutate(
      { connectionId, source: { repo: repo.trim(), branch: branch.trim() || 'main', path: path.trim(), schema: schema.trim() || 'public' } },
      {
        onSuccess: () => {
          toastManager.add({ type: 'success', title: 'Schema source configured' })
        },
        onError: (err) => {
          toastManager.add({ type: 'error', title: 'Failed to save schema source', description: err.message })
        },
      },
    )
  }

  return (
    <div className="p-4 space-y-3">
      <StatusMessage icon={<GitBranch className="size-4" />} text="Configure schema source" className="text-gray-600" />
      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="text-xs font-medium text-gray-600">Repository URL *</label>
          <Input size="sm" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://github.com/org/repo.git" required />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Branch</label>
          <Input size="sm" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Schema file path *</label>
          <Input size="sm" value={path} onChange={(e) => setPath(e.target.value)} placeholder="schema.sql" required />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">Target schema</label>
          <Input size="sm" value={schema} onChange={(e) => setSchema(e.target.value)} placeholder="public" />
        </div>
        <Button type="submit" size="sm" disabled={setSchemaSource.isPending || !repo.trim() || !path.trim()}>
          {setSchemaSource.isPending ? <><Spinner className="size-3.5 mr-1.5" /> Saving...</> : 'Save'}
        </Button>
      </form>
    </div>
  )
}

export function MigrationPanel({ connectionId }: MigrationPanelProps) {
  const { hasDdl } = useConnectionPermissions(connectionId)
  const queryClient = useQueryClient()
  const statusQuery = useSchemaSourceStatus(connectionId)
  const planMutation = usePlanMigration()
  const applyMutation = useApplyMigration()
  const [showSql, setShowSql] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (statusQuery.isLoading) {
    return (
      <div className="p-4 flex items-center gap-2 text-sm text-gray-500">
        <Spinner className="size-4" />
        <span>Checking configuration...</span>
      </div>
    )
  }

  if (!statusQuery.data?.configured) {
    return <SchemaSourceSetup connectionId={connectionId} />
  }

  const state = derivePanelState(planMutation, applyMutation)

  const handlePlan = () => {
    applyMutation.reset()
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

  switch (state.kind) {
    case 'idle':
      return (
        <div className="p-4 space-y-3">
          <StatusMessage icon={<GitBranch className="size-4" />} text="Compare current database schema with git source" className="text-gray-600" />
          <Button onClick={handlePlan} size="sm">
            <RefreshCw className="size-3.5 mr-1.5" />
            Compare with Git
          </Button>
        </div>
      )

    case 'planning':
      return (
        <div className="p-4 flex items-center gap-2 text-sm text-gray-500">
          <Spinner className="size-4" />
          <span>Analyzing schema differences...</span>
        </div>
      )

    case 'plan-error':
      return (
        <div className="p-4 space-y-3">
          <StatusMessage icon={<AlertTriangle className="size-4" />} text="Failed to generate plan" className="text-red-600" />
          <p className="text-xs text-red-500">{state.error}</p>
          <Button onClick={handlePlan} size="sm" variant="outline">
            <RefreshCw className="size-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      )

    case 'up-to-date':
      return (
        <div className="p-4 space-y-3">
          <StatusMessage icon={<CircleCheck className="size-4" />} text="Schema is up to date with git" className="text-green-600" />
          <p className="text-xs text-gray-500">
            Branch: {state.plan.branch} &middot; Commit: {state.plan.commitHash.slice(0, 7)}
          </p>
          <Button onClick={handlePlan} size="sm" variant="outline">
            <RefreshCw className="size-3.5 mr-1.5" />
            Refresh
          </Button>
        </div>
      )

    case 'applying':
      return (
        <div className="p-4 flex items-center gap-2 text-sm text-gray-500">
          <Spinner className="size-4" />
          <span>Applying migration...</span>
        </div>
      )

    case 'apply-error':
      return (
        <div className="p-4 space-y-3">
          <StatusMessage icon={<AlertTriangle className="size-4" />} text="Migration failed" className="text-red-600" />
          <p className="text-xs text-red-500">{state.error}</p>
          <Button onClick={handlePlan} size="sm" variant="outline">
            <RefreshCw className="size-3.5 mr-1.5" />
            Re-plan
          </Button>
        </div>
      )

    case 'apply-success':
      return (
        <div className="p-4 space-y-3">
          <StatusMessage icon={<CircleCheck className="size-4" />} text="Migration applied successfully" className="text-green-600" />
          <Button onClick={handlePlan} size="sm" variant="outline">
            <RefreshCw className="size-3.5 mr-1.5" />
            Compare again
          </Button>
        </div>
      )

    case 'has-diffs':
      return (
        <div className="flex flex-col h-full">
          <div className="px-3 py-2 border-b border-gray-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{state.plan.summary}</span>
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
              Branch: {state.plan.branch} &middot; Commit: {state.plan.commitHash.slice(0, 7)}
            </p>
          </div>

          <ScrollArea className="flex-1">
            <div className="py-1">
              {state.diffs.map((diff, i) => (
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
              {showSql ? 'Hide' : 'Show'} DDL ({state.diffs.length} statement{state.diffs.length > 1 ? 's' : ''})
            </button>
            {showSql && (
              <div className="px-3 pb-3 max-h-48 overflow-auto">
                <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap">
                  {state.diffs.map(d => d.sql).join('\n\n')}
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
                    This will execute {state.diffs.length} DDL statement{state.diffs.length > 1 ? 's' : ''} against the database.
                    {!state.plan.canRunInTransaction && (
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
}
