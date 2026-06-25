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
  const { data: connections } = useConnections()
  const { hasAdmin } = useConnectionPermissions(connectionId)

  // Admin-only page. Gate on the selected connection's admin permission.
  if (!hasAdmin) {
    return (
      <div className="flex-1 bg-white text-gray-900 overflow-auto">
        <div className="p-8">
          <h1 className="text-3xl font-bold mb-2">Audit Log</h1>
          <p className="text-gray-600">
            You need admin permission on this connection to view its audit log.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-white text-gray-900 overflow-auto">
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-8">Audit Log</h1>

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

        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 py-16 text-gray-500">
          <ScrollText size={32} />
          <p className="text-sm">No audit log entries yet.</p>
        </div>
      </div>
    </div>
  )
}
