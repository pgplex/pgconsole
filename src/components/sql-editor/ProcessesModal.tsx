import { useState, useCallback, useEffect } from 'react'
import { RefreshCw, X, XCircle } from 'lucide-react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { toastManager } from '@/components/ui/toast'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { useActiveProcesses, useTerminateProcess } from '@/hooks/useQuery'
import { useConnectionPermissions } from '@/hooks/usePermissions'

interface ProcessesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
}

function formatDuration(startTime: string | null): string {
  if (!startTime) return '-'
  const start = new Date(startTime)
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()

  if (diffMs < 0) return '-'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`

  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

function truncateQuery(query: string, maxLength = 50): string {
  if (!query) return '-'
  const singleLine = query.replace(/\s+/g, ' ').trim()
  if (singleLine.length <= maxLength) return singleLine
  return singleLine.slice(0, maxLength) + '...'
}

function getStateBadgeVariant(state: string): 'success' | 'warning' | 'info' | 'muted' {
  switch (state) {
    case 'active':
      return 'success'
    case 'idle in transaction':
    case 'idle in transaction (aborted)':
      return 'warning'
    case 'idle':
      return 'info'
    default:
      return 'muted'
  }
}

export function ProcessesModal({ open, onOpenChange, connectionId }: ProcessesModalProps) {
  const { data: processes, isLoading, refetch, isRefetching } = useActiveProcesses(connectionId, open)
  const { hasAdmin } = useConnectionPermissions(connectionId)
  const terminateProcess = useTerminateProcess()
  const [confirmPid, setConfirmPid] = useState<number | null>(null)
  const [countdown, setCountdown] = useState(5)

  // Countdown timer for auto-refresh
  useEffect(() => {
    if (!open) return

    const interval = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 5 : prev - 1))
    }, 1000)

    return () => clearInterval(interval)
  }, [open])

  // Reset countdown when data is refetched
  useEffect(() => {
    if (!isRefetching) {
      setCountdown(5)
    }
  }, [isRefetching])

  const handleTerminate = useCallback(async (pid: number) => {
    try {
      await terminateProcess.mutateAsync({ connectionId, pid })
      toastManager.add({ type: 'success', title: `Process ${pid} terminated` })
      setConfirmPid(null)
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: 'Failed to terminate process',
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }, [connectionId, terminateProcess])

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/10" />
          <DialogPrimitive.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <DialogPrimitive.Popup className="relative w-full max-w-5xl rounded-2xl border bg-white shadow-lg flex flex-col h-[70vh]">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <DialogPrimitive.Title className="text-lg font-semibold">
                  Active Processes
                  {processes && (
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({processes.length})
                    </span>
                  )}
                </DialogPrimitive.Title>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 tabular-nums">Refreshes in {countdown}s</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isRefetching}
                  >
                    <RefreshCw className={`size-3.5 mr-1 ${isRefetching ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onOpenChange(false)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0 p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Spinner className="size-6 text-gray-400" />
                  </div>
                ) : !processes || processes.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No active processes
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>PID</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Database</TableHead>
                          <TableHead>Application</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead>Query</TableHead>
                          <TableHead>Duration</TableHead>
                          {hasAdmin && (
                            <TableHead className="text-center">Actions</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processes.map((process) => (
                          <TableRow key={process.pid}>
                            <TableCell className="font-mono text-xs">
                              {process.pid}
                            </TableCell>
                            <TableCell>{process.usename || '-'}</TableCell>
                            <TableCell>{process.datname}</TableCell>
                            <TableCell>{process.applicationName || '-'}</TableCell>
                            <TableCell>
                              <Badge variant={getStateBadgeVariant(process.state)} size="sm">
                                {process.state || 'unknown'}
                              </Badge>
                            </TableCell>
                            <TableCell
                              className="max-w-xs font-mono text-xs"
                              title={process.query}
                            >
                              {truncateQuery(process.query)}
                            </TableCell>
                            <TableCell className="tabular-nums text-xs">
                              {formatDuration(process.queryStart || null)}
                            </TableCell>
                            {hasAdmin && (
                              <TableCell className="text-center">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => setConfirmPid(process.pid)}
                                  disabled={terminateProcess.isPending}
                                >
                                  <XCircle className="size-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

            </DialogPrimitive.Popup>
          </DialogPrimitive.Viewport>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Confirmation Dialog */}
      <AlertDialogPrimitive.Root
        open={confirmPid !== null}
        onOpenChange={(isOpen) => !isOpen && setConfirmPid(null)}
      >
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-[60] bg-black/32 backdrop-blur-sm" />
          <AlertDialogPrimitive.Viewport className="fixed inset-0 z-[60] grid place-items-center p-4">
            <AlertDialogPrimitive.Popup className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-lg">
              <AlertDialogPrimitive.Title className="text-lg font-semibold">
                Terminate Process
              </AlertDialogPrimitive.Title>
              <AlertDialogPrimitive.Description className="mt-2 text-sm text-gray-500">
                Are you sure you want to terminate process <span className="font-mono font-medium">{confirmPid}</span>?
                This will forcefully end the backend and any running queries.
              </AlertDialogPrimitive.Description>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmPid(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => confirmPid && handleTerminate(confirmPid)}
                  disabled={terminateProcess.isPending}
                >
                  {terminateProcess.isPending ? 'Terminating...' : 'Terminate'}
                </Button>
              </div>
            </AlertDialogPrimitive.Popup>
          </AlertDialogPrimitive.Viewport>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>
    </>
  )
}
