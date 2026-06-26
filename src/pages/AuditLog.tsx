import { useNavigate } from 'react-router-dom'
import { ScrollText } from 'lucide-react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useConnections, useAuditLogEntries, useSystemAuditLogEntries } from '@/hooks/useQuery'
import { useConnectionPermissions } from '@/hooks/usePermissions'
import { useOwner } from '@/hooks/useOwner'
import type { AuditLogEntry } from '@/gen/query_pb'

interface AuditLogProps {
  connectionId: string
}

function StatusBadge({ success }: { success: boolean }) {
  return (
    <Badge variant={success ? 'success' : 'error'}>{success ? 'Success' : 'Failed'}</Badge>
  )
}

function ActionCell({ action, source }: { action: string; source?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span>{action}</span>
      {source && <Badge variant="muted">{source}</Badge>}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 py-16 text-gray-500">
      <ScrollText size={32} />
      <p className="text-sm">{label}</p>
    </div>
  )
}

// Shared loading / error / empty handling for a tab's entries; renders the table only
// once entries have loaded and are non-empty.
function EntriesPanel({
  entries,
  isLoading,
  error,
  emptyLabel,
  children,
}: {
  entries: AuditLogEntry[] | undefined
  isLoading: boolean
  error: unknown
  emptyLabel: string
  children: (entries: AuditLogEntry[]) => React.ReactNode
}) {
  if (error) return <p className="text-red-600 text-sm">Failed to load audit log entries.</p>
  if (isLoading || !entries) return <div className="text-gray-500 text-sm">Loading audit log…</div>
  if (entries.length === 0) return <EmptyState label={emptyLabel} />
  return <>{children(entries)}</>
}

export default function AuditLog({ connectionId }: AuditLogProps) {
  const navigate = useNavigate()
  const isOwner = useOwner()
  const { data: connections, isLoading, error } = useConnections()
  const { hasAdmin } = useConnectionPermissions(connectionId)

  const canLoadConnEntries = !!connections && connections.length > 0 && hasAdmin
  const connQuery = useAuditLogEntries(connectionId, canLoadConnEntries)
  // System tab is instance-owner only; the query is owner-gated server-side too.
  const sysQuery = useSystemAuditLogEntries(isOwner)

  // Connection tab: resolve the connections query (loading/error/empty) and the per-connection
  // admin gate before showing entries — otherwise admins briefly see the denied state on load.
  const connectionContent = error ? (
    <p className="text-red-600 text-sm">Failed to load connections.</p>
  ) : isLoading || !connections ? (
    <div className="text-gray-500 text-sm">Loading…</div>
  ) : connections.length === 0 ? (
    <p className="text-gray-600">No connections are configured.</p>
  ) : !hasAdmin ? (
    <p className="text-gray-600">
      You need admin permission on this connection to view its audit log.
    </p>
  ) : (
    <EntriesPanel
      entries={connQuery.data}
      isLoading={connQuery.isLoading}
      error={connQuery.error}
      emptyLabel="No audit log entries yet."
    >
      {(entries) => (
        <div className="rounded-lg border border-gray-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>SQL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, idx) => (
                <TableRow key={`${entry.timestamp}-${entry.action}-${entry.actor}-${idx}`}>
                  <TableCell className="text-gray-600">{new Date(entry.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{entry.actor}</TableCell>
                  <TableCell><ActionCell action={entry.action} source={entry.source} /></TableCell>
                  <TableCell><StatusBadge success={entry.success} /></TableCell>
                  <TableCell>{entry.rowCount !== undefined ? entry.rowCount : '—'}</TableCell>
                  <TableCell>{entry.durationMs !== undefined ? `${entry.durationMs}ms` : '—'}</TableCell>
                  <TableCell className="max-w-xl">
                    <div className="truncate font-mono text-xs" title={entry.error || entry.sql}>
                      {entry.error || entry.sql || '—'}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </EntriesPanel>
  )

  // System tab: app-level auth events (login/logout), not tied to a connection.
  const systemContent = (
    <EntriesPanel
      entries={sysQuery.data}
      isLoading={sysQuery.isLoading}
      error={sysQuery.error}
      emptyLabel="No system audit log entries yet."
    >
      {(entries) => (
        <div className="rounded-lg border border-gray-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, idx) => (
                <TableRow key={`${entry.timestamp}-${entry.action}-${entry.actor}-${idx}`}>
                  <TableCell className="text-gray-600">{new Date(entry.timestamp).toLocaleString()}</TableCell>
                  <TableCell>{entry.actor}</TableCell>
                  <TableCell><ActionCell action={entry.action} /></TableCell>
                  <TableCell><StatusBadge success={entry.success} /></TableCell>
                  <TableCell>{entry.provider || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.ip || '—'}</TableCell>
                  <TableCell className="max-w-xl">
                    <div className="truncate text-xs text-gray-600" title={entry.error}>
                      {entry.error || '—'}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </EntriesPanel>
  )

  return (
    <div className="flex-1 bg-white text-gray-900 overflow-auto">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">Audit Log</h1>

        <Tabs defaultValue="connection">
          <TabsList className="mb-6">
            <TabsTrigger value="connection">Connection</TabsTrigger>
            {isOwner && <TabsTrigger value="system">System</TabsTrigger>}
          </TabsList>

          <TabsContent value="connection">
            {/* Connection selector stays outside the admin gate so a user without admin on the
                current connection can still switch to one where they do have access. */}
            <div className="space-y-2 max-w-xs mb-8">
              <Label htmlFor="audit-connection">Connection</Label>
              <Select
                value={connectionId}
                onValueChange={(id) => navigate(`/audit-log?connectionId=${id}`)}
              >
                <SelectTrigger id="audit-connection">
                  <SelectValue placeholder="Select connection" />
                </SelectTrigger>
                <SelectContent>
                  {connections?.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {connectionContent}
          </TabsContent>

          {isOwner && <TabsContent value="system">{systemContent}</TabsContent>}
        </Tabs>
      </div>
    </div>
  )
}
