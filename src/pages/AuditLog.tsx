import { useNavigate } from 'react-router-dom'
import { ScrollText } from 'lucide-react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useConnections } from '@/hooks/useQuery'
import { useConnectionPermissions } from '@/hooks/usePermissions'

interface AuditLogProps {
  connectionId: string
}

export default function AuditLog({ connectionId }: AuditLogProps) {
  const navigate = useNavigate()
  const { data: connections, isLoading } = useConnections()
  const { hasAdmin } = useConnectionPermissions(connectionId)

  // Permissions are derived from the connections query, so defer the admin gate
  // until it resolves — otherwise admins briefly see the denied state on load.
  const content = isLoading || !connections ? (
    <div className="text-gray-500 text-sm">Loading…</div>
  ) : !hasAdmin ? (
    <p className="text-gray-600">
      You need admin permission on this connection to view its audit log.
    </p>
  ) : (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 py-16 text-gray-500">
      <ScrollText size={32} />
      <p className="text-sm">No audit log entries yet.</p>
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
