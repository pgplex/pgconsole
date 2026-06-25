import { useNavigate } from 'react-router-dom'
import { ScrollText } from 'lucide-react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { useConnections, useAuditLogEntries } from '@/hooks/useQuery'
import { useConnectionPermissions } from '@/hooks/usePermissions'

interface AuditLogProps {
  connectionId: string
}

export default function AuditLog({ connectionId }: AuditLogProps) {
  const navigate = useNavigate()
  const { data: connections, isLoading, error } = useConnections()
  const { hasAdmin } = useConnectionPermissions(connectionId)
  const canLoadEntries = !!connections && connections.length > 0 && hasAdmin
  const {
    data: entries,
    isLoading: entriesLoading,
    error: entriesError,
  } = useAuditLogEntries(connectionId, canLoadEntries)

  // Permissions are derived from the connections query, so resolve its loading,
  // error, and empty states before gating on hasAdmin — otherwise admins briefly
  // see the denied state on load, and errors/empty lists show misleading UI.
  const content = error ? (
    <p className="text-red-600 text-sm">Failed to load connections.</p>
  ) : isLoading || !connections ? (
    <div className="text-gray-500 text-sm">Loading…</div>
  ) : connections.length === 0 ? (
    <p className="text-gray-600">No connections are configured.</p>
  ) : !hasAdmin ? (
    <p className="text-gray-600">
      You need admin permission on this connection to view its audit log.
    </p>
  ) : entriesError ? (
    <p className="text-red-600 text-sm">Failed to load audit log entries.</p>
  ) : entriesLoading || !entries ? (
    <div className="text-gray-500 text-sm">Loading audit log…</div>
  ) : entries.length === 0 ? (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 py-16 text-gray-500">
      <ScrollText size={32} />
      <p className="text-sm">No audit log entries yet.</p>
    </div>
  ) : (
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
              <TableCell className="text-gray-600">
                {new Date(entry.timestamp).toLocaleString()}
              </TableCell>
              <TableCell>{entry.actor}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span>{entry.action}</span>
                  {entry.source && <Badge variant="muted">{entry.source}</Badge>}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={entry.success ? 'success' : 'error'}>
                  {entry.success ? 'Success' : 'Failed'}
                </Badge>
              </TableCell>
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
  )

  return (
    <div className="flex-1 bg-white text-gray-900 overflow-auto">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">Audit Log</h1>

        {/* Connection selector stays outside the gate so a user without admin on the
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

        {content}
      </div>
    </div>
  )
}
