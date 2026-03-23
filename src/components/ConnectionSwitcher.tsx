import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Database, AlertCircle, Loader2, Activity } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipPopup } from './ui/tooltip'
import { Menu, MenuTrigger, MenuPopup, MenuItem, MenuSeparator } from './ui/menu'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { useConnections, useConnectionHealth } from '../hooks/useQuery'
import { connectionClient } from '../lib/connect-client'
import { useSession } from '../lib/auth-client'

const PERMISSION_VARIANTS: Record<string, 'default' | 'warning' | 'info' | 'muted' | 'success' | 'secondary' | 'outline'> = {
  admin: 'default',
  ddl: 'warning',
  write: 'info',
  read: 'success',
  explain: 'muted',
  execute: 'secondary',
  export: 'outline',
}

// Low to high privilege order
const PERMISSION_ORDER: string[] = ['explain', 'read', 'execute', 'export', 'write', 'ddl', 'admin']

function sortPermissions(permissions: string[]): string[] {
  return [...permissions].sort((a, b) => PERMISSION_ORDER.indexOf(a) - PERMISSION_ORDER.indexOf(b))
}

interface ConnectionSwitcherProps {
  selectedConnectionId: string
}

export function ConnectionSwitcher({ selectedConnectionId }: ConnectionSwitcherProps) {
  const navigate = useNavigate()
  const { data: connections, isLoading } = useConnections()
  const { authEnabled } = useSession()

  // Test current connection health
  const { data: healthCheck } = useConnectionHealth(selectedConnectionId, !!selectedConnectionId)
  const isConnectionDown = healthCheck && !healthCheck.success

  const [pingResults, setPingResults] = useState<Record<string, { loading: boolean; latencyMs?: number; error?: string }>>({})
  const isPinging = Object.values(pingResults).some((r) => r.loading)

  const handlePing = useCallback(() => {
    if (!connections || isPinging) return
    const initial: Record<string, { loading: boolean }> = {}
    for (const conn of connections) {
      initial[conn.id] = { loading: true }
    }
    setPingResults(initial)

    for (const conn of connections) {
      connectionClient.testConnection({ id: conn.id }).then(
        (response) => {
          setPingResults((prev) => ({
            ...prev,
            [conn.id]: {
              loading: false,
              latencyMs: response.success ? response.latencyMs : undefined,
              error: response.error || undefined,
            },
          }))
        },
        (err) => {
          setPingResults((prev) => ({
            ...prev,
            [conn.id]: { loading: false, error: err instanceof Error ? err.message : 'Unknown error' },
          }))
        },
      )
    }
  }, [connections, isPinging])

  const currentConnection = connections?.find((c) => c.id === selectedConnectionId)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Database size={14} />
        <span>Loading...</span>
      </div>
    )
  }

  if (!connections || connections.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Database size={14} />
        <span>No connections</span>
        <span className="text-xs">
          (Check{' '}
          <a
            href="https://docs.pgconsole.com/configuration/iam-permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            IAM permissions
          </a>
          )
        </span>
      </div>
    )
  }

  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="!h-auto !py-1 !px-2 gap-1"
                />
              }
            />
          }
        >
          {currentConnection ? (
            <div className="flex flex-col items-start text-left gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium whitespace-nowrap">{currentConnection.name}</span>
                {isConnectionDown && (
                  <Tooltip>
                    <TooltipTrigger render={<AlertCircle className="text-red-500" size={14} />} />
                    <TooltipPopup>
                      <div className="text-sm">
                        Connection unavailable
                        {healthCheck?.error && (
                          <div className="text-xs text-gray-400 mt-1">{healthCheck.error}</div>
                        )}
                      </div>
                    </TooltipPopup>
                  </Tooltip>
                )}
                {currentConnection.labels && currentConnection.labels.length > 0 && (
                  <div className="flex gap-1 shrink-0">
                    {currentConnection.labels.map((label) => (
                      <Badge
                        key={label.id}
                        size="sm"
                        variant="outline"
                        style={{ borderColor: label.color, color: label.color }}
                      >
                        {label.name}
                      </Badge>
                    ))}
                  </div>
                )}
                {authEnabled && currentConnection.permissions.length > 0 && (
                  <div className="flex gap-1 shrink-0">
                    {sortPermissions(currentConnection.permissions).map((perm) => (
                      <Badge key={perm} size="sm" variant={PERMISSION_VARIANTS[perm] ?? 'muted'}>
                        {perm}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {currentConnection.username}@{currentConnection.host}:{currentConnection.port}/{currentConnection.database}
              </span>
            </div>
          ) : (
            'Select connection'
          )}
          <ChevronDown size={14} className="shrink-0" />
        </TooltipTrigger>
        {currentConnection && (
          <TooltipPopup side="bottom">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{currentConnection.name}</span>
                {currentConnection.labels && currentConnection.labels.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {currentConnection.labels.map((label) => (
                      <Badge
                        key={label.id}
                        size="sm"
                        variant="outline"
                        style={{ borderColor: label.color, color: label.color }}
                      >
                        {label.name}
                      </Badge>
                    ))}
                  </div>
                )}
                {authEnabled && currentConnection.permissions.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {sortPermissions(currentConnection.permissions).map((perm) => (
                      <Badge key={perm} size="sm" variant={PERMISSION_VARIANTS[perm] ?? 'muted'}>
                        {perm}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-muted-foreground">
                {currentConnection.username}@{currentConnection.host}:{currentConnection.port}/{currentConnection.database}
              </span>
            </div>
          </TooltipPopup>
        )}
      </Tooltip>
      <MenuPopup>
        <MenuItem closeOnClick={false} onClick={handlePing} disabled={isPinging}>
          {isPinging ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
          <span>Ping</span>
        </MenuItem>
        <MenuSeparator />
        {connections.map((conn) => {
          const ping = pingResults[conn.id]
          return (
            <MenuItem
              key={conn.id}
              onClick={() => navigate(`/?connectionId=${conn.id}`)}
              className={selectedConnectionId === conn.id ? 'bg-gray-100' : ''}
            >
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{conn.name}</span>
                  {conn.labels && conn.labels.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {conn.labels.map((label) => (
                        <Badge
                          key={label.id}
                          size="sm"
                          variant="outline"
                          style={{ borderColor: label.color, color: label.color }}
                        >
                          {label.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {authEnabled && conn.permissions.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {sortPermissions(conn.permissions).map((perm) => (
                        <Badge key={perm} size="sm" variant={PERMISSION_VARIANTS[perm] ?? 'muted'}>
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {ping && (
                    <span className="ml-auto pl-2 shrink-0">
                      {ping.loading ? (
                        <Loader2 size={14} className="animate-spin text-muted-foreground" />
                      ) : ping.error ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span className="flex items-center">
                                <AlertCircle size={14} className="text-red-500" />
                              </span>
                            }
                          />
                          <TooltipPopup side="right" className="z-[100]">
                            <span className="text-xs">{ping.error}</span>
                          </TooltipPopup>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-green-600">{ping.latencyMs}ms</span>
                      )}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {conn.username}@{conn.host}:{conn.port}/{conn.database}
                </span>
              </div>
            </MenuItem>
          )
        })}
      </MenuPopup>
    </Menu>
  )
}
