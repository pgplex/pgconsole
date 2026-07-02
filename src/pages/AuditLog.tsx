import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, ScrollText } from 'lucide-react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useConnections, useAuditLogEntries, useSystemAuditLogEntries } from '@/hooks/useQuery'
import { useConnectionPermissions } from '@/hooks/usePermissions'
import { useOwner } from '@/hooks/useOwner'
import { exportToCsv } from '@/lib/export-csv'
import type { AuditLogEntry } from '@/gen/query_pb'

interface AuditLogProps {
  connectionId: string
}

type AuditScope = 'connection' | 'system'

interface AuditFilters {
  search: string
  action: string
  source: string
  status: string
  fromDate: string
  toDate: string
}

const DEFAULT_FILTERS: AuditFilters = {
  search: '',
  action: 'all',
  source: 'all',
  status: 'all',
  fromDate: '',
  toDate: '',
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

function uniqueValues(entries: AuditLogEntry[], pick: (entry: AuditLogEntry) => string) {
  return Array.from(new Set(entries.map(pick).filter(Boolean))).sort()
}

function matchesDateRange(entry: AuditLogEntry, fromDate: string, toDate: string) {
  if (!fromDate && !toDate) return true
  const ts = new Date(entry.timestamp).getTime()
  if (Number.isNaN(ts)) return false
  if (fromDate) {
    const from = new Date(`${fromDate}T00:00:00`).getTime()
    if (ts < from) return false
  }
  if (toDate) {
    const to = new Date(`${toDate}T23:59:59.999`).getTime()
    if (ts > to) return false
  }
  return true
}

function entrySearchText(entry: AuditLogEntry) {
  return [
    entry.timestamp,
    entry.actor,
    entry.action,
    entry.connection,
    entry.database,
    entry.sql,
    entry.error,
    entry.format,
    entry.source,
    entry.tool,
    entry.agent,
    entry.provider,
    entry.ip,
  ].join(' ').toLowerCase()
}

function filterEntries(entries: AuditLogEntry[], filters: AuditFilters) {
  const search = filters.search.trim().toLowerCase()
  return entries.filter((entry) => {
    if (filters.action !== 'all' && entry.action !== filters.action) return false
    if (filters.source !== 'all' && entry.source !== filters.source) return false
    if (filters.status === 'success' && !entry.success) return false
    if (filters.status === 'failed' && entry.success) return false
    if (!matchesDateRange(entry, filters.fromDate, filters.toDate)) return false
    if (search && !entrySearchText(entry).includes(search)) return false
    return true
  })
}

function csvRows(entries: AuditLogEntry[]) {
  return entries.map((entry) => ({
    Time: entry.timestamp,
    Actor: entry.actor,
    Action: entry.action,
    Source: entry.source,
    Status: entry.success ? 'success' : 'failed',
    Connection: entry.connection,
    Database: entry.database,
    Provider: entry.provider,
    IP: entry.ip,
    Rows: entry.rowCount ?? '',
    'Duration ms': entry.durationMs ?? '',
    SQL: entry.sql,
    Error: entry.error,
    Format: entry.format,
    Tool: entry.tool,
    Agent: entry.agent,
  }))
}

function exportAuditEntries(entries: AuditLogEntry[], scope: AuditScope) {
  const columns = [
    'Time',
    'Actor',
    'Action',
    'Source',
    'Status',
    'Connection',
    'Database',
    'Provider',
    'IP',
    'Rows',
    'Duration ms',
    'SQL',
    'Error',
    'Format',
    'Tool',
    'Agent',
  ].map((name) => ({ name }))
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  exportToCsv(columns, csvRows(entries), `audit-log-${scope}-${timestamp}.csv`)
}

function AuditFilterBar({
  scope,
  entries,
  filters,
  onFiltersChange,
  filteredCount,
}: {
  scope: AuditScope
  entries: AuditLogEntry[]
  filters: AuditFilters
  onFiltersChange: (filters: AuditFilters) => void
  filteredCount: number
}) {
  const actions = uniqueValues(entries, (entry) => entry.action)
  const sources = uniqueValues(entries, (entry) => entry.source)
  const searchId = `audit-${scope}-search`
  const actionId = `audit-${scope}-action`
  const sourceId = `audit-${scope}-source`
  const statusId = `audit-${scope}-status`
  const fromId = `audit-${scope}-from`
  const toId = `audit-${scope}-to`

  return (
    <div className="mb-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_160px_140px_140px_140px_140px]">
        <div className="space-y-1.5">
          <Label htmlFor={searchId}>Search</Label>
          <Input
            id={searchId}
            type="search"
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            placeholder="Actor, SQL, error, IP..."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={actionId}>Action</Label>
          <Select
            value={filters.action}
            onValueChange={(action) => onFiltersChange({ ...filters, action: action ?? 'all' })}
          >
            <SelectTrigger id={actionId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map((action) => (
                <SelectItem key={action} value={action}>{action}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={sourceId}>Source</Label>
          <Select
            value={filters.source}
            onValueChange={(source) => onFiltersChange({ ...filters, source: source ?? 'all' })}
          >
            <SelectTrigger id={sourceId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {sources.map((source) => (
                <SelectItem key={source} value={source}>{source}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={statusId}>Status</Label>
          <Select
            value={filters.status}
            onValueChange={(status) => onFiltersChange({ ...filters, status: status ?? 'all' })}
          >
            <SelectTrigger id={statusId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={fromId}>From</Label>
          <Input
            id={fromId}
            type="date"
            value={filters.fromDate}
            onChange={(event) => onFiltersChange({ ...filters, fromDate: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={toId}>To</Label>
          <Input
            id={toId}
            type="date"
            value={filters.toDate}
            onChange={(event) => onFiltersChange({ ...filters, toDate: event.target.value })}
          />
        </div>
      </div>
      <p className="text-sm text-gray-500">
        Showing {filteredCount} of {entries.length} recent entries
      </p>
    </div>
  )
}

function AuditEntriesView({
  entries,
  scope,
  filters,
  onFiltersChange,
  filteredEntries,
}: {
  entries: AuditLogEntry[]
  scope: AuditScope
  filters: AuditFilters
  onFiltersChange: (filters: AuditFilters) => void
  filteredEntries: AuditLogEntry[]
}) {
  return (
    <>
      <AuditFilterBar
        scope={scope}
        entries={entries}
        filters={filters}
        onFiltersChange={onFiltersChange}
        filteredCount={filteredEntries.length}
      />
      {filteredEntries.length === 0 ? (
        <EmptyState label="No audit log entries match these filters." />
      ) : scope === 'connection' ? (
        <ConnectionAuditTable entries={filteredEntries} />
      ) : (
        <SystemAuditTable entries={filteredEntries} />
      )}
    </>
  )
}

function ConnectionAuditTable({ entries }: { entries: AuditLogEntry[] }) {
  return (
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
  )
}

function SystemAuditTable({ entries }: { entries: AuditLogEntry[] }) {
  return (
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
              <TableCell><ActionCell action={entry.action} source={entry.source} /></TableCell>
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
  children: (entries: AuditLogEntry[]) => ReactNode
}) {
  // Only show the spinner while actually fetching. When the query is disabled
  // (e.g. a non-owner), React Query leaves `isLoading` false and `data` undefined —
  // fall through to the empty state rather than spinning forever.
  if (error) return <p className="text-red-600 text-sm">Failed to load audit log entries.</p>
  if (isLoading) return <div className="text-gray-500 text-sm">Loading audit log…</div>
  if (!entries || entries.length === 0) return <EmptyState label={emptyLabel} />
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

  // Filters live here (not per-tab) so the shared Export button on the tab bar can
  // export whichever tab is active. Switching connections resets the connection filters,
  // matching the previous per-connection remount behaviour.
  const [activeTab, setActiveTab] = useState<AuditScope>('connection')
  const [connFilters, setConnFilters] = useState(DEFAULT_FILTERS)
  const [sysFilters, setSysFilters] = useState(DEFAULT_FILTERS)
  useEffect(() => setConnFilters(DEFAULT_FILTERS), [connectionId])

  const connFiltered = useMemo(
    () => filterEntries(connQuery.data ?? [], connFilters),
    [connQuery.data, connFilters],
  )
  const sysFiltered = useMemo(
    () => filterEntries(sysQuery.data ?? [], sysFilters),
    [sysQuery.data, sysFilters],
  )
  const activeFiltered = activeTab === 'connection' ? connFiltered : sysFiltered

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
        <AuditEntriesView
          entries={entries}
          scope="connection"
          filters={connFilters}
          onFiltersChange={setConnFilters}
          filteredEntries={connFiltered}
        />
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
        <AuditEntriesView
          entries={entries}
          scope="system"
          filters={sysFilters}
          onFiltersChange={setSysFilters}
          filteredEntries={sysFiltered}
        />
      )}
    </EntriesPanel>
  )

  return (
    <div className="flex-1 bg-white text-gray-900 overflow-auto">
      <div className="p-8">
        <Button
          variant="ghost"
          onClick={() => navigate(`/?connectionId=${connectionId}`)}
          className="-ml-2 mb-4"
        >
          <ArrowLeft />
          Back to editor
        </Button>
        <h1 className="text-3xl font-bold mb-8">Audit Log</h1>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AuditScope)}>
          <div className="mb-6 flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="connection">Connection</TabsTrigger>
              {isOwner && <TabsTrigger value="system">System</TabsTrigger>}
            </TabsList>
            <Button
              onClick={() => exportAuditEntries(activeFiltered, activeTab)}
              disabled={activeFiltered.length === 0}
            >
              <Download />
              Export CSV
            </Button>
          </div>

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
