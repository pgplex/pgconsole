import { useState } from 'react'
import { Pencil, Clipboard, Check, Sparkles } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useFunctionInfo, useFunctionDependencies, useExecuteSQL, queryKeys } from '../../../hooks/useQuery'
import { useConnectionPermissions } from '../../../hooks/usePermissions'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { ScrollArea } from '../../ui/scroll-area'
import { Tooltip, TooltipTrigger, TooltipPopup } from '../../ui/tooltip'
import { FunctionArgumentList } from '../FunctionArgumentForm'
import { EditDefinitionModal } from '../EditDefinitionModal'
import { parseFunctionArguments } from '@/lib/sql/parse-function-args'
import { InfoItem, getKindLabel, SQLDefinition } from './shared'
import { aiClient } from '@/lib/connect-client'
import type { ObjectType } from '../ObjectTree'

interface FunctionSchemaContentProps {
  connectionId: string
  schema: string
  name: string
  objectType: 'function' | 'procedure'
  arguments?: string
  onViewSchema?: (schema: string, objectName: string, objectType: ObjectType, args?: string) => void
  onExplainWithAI?: (sql: string) => void
}

export function FunctionSchemaContent({
  connectionId,
  schema,
  name,
  objectType,
  arguments: args,
  onViewSchema,
  onExplainWithAI,
}: FunctionSchemaContentProps) {
  const queryClient = useQueryClient()
  const { data: functionInfo, isLoading } = useFunctionInfo(connectionId, schema, name, args)
  const { data: dependencies } = useFunctionDependencies(connectionId, schema, name, args)
  const { hasDdl } = useConnectionPermissions(connectionId)
  const executeSQL = useExecuteSQL()
  const [showEditModal, setShowEditModal] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: providersData } = useQuery({
    queryKey: ['ai', 'providers'],
    queryFn: () => aiClient.listAIProviders({}),
  })
  const hasAIProvider = (providersData?.providers?.length ?? 0) > 0

  const handleCopyDefinition = async () => {
    if (!functionInfo?.definition) return
    await navigator.clipboard.writeText(functionInfo.definition)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const parsedArgs = functionInfo?.arguments
    ? parseFunctionArguments(functionInfo.arguments)
    : []

  const handleApplyChanges = async (sql: string) => {
    setApplyError(null)
    try {
      const result = await executeSQL.mutateAsync({ connectionId, sql })
      if (result.error) {
        setApplyError(result.error)
        return
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.functionInfo(connectionId, schema, name, args) })
      setShowEditModal(false)
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed to apply changes')
    }
  }

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="p-4">
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg font-semibold">{name}</h1>
          <Badge variant="secondary">{schema}</Badge>
          <Badge variant="muted">{getKindLabel(objectType)}</Badge>
        </div>

        {functionInfo && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <InfoItem label="Owner" value={functionInfo.owner} />
            <InfoItem label="Language" value={functionInfo.language} />
            {functionInfo.returnType && (
              <InfoItem label="Returns" value={functionInfo.returnType} />
            )}
            <InfoItem label="Volatility" value={functionInfo.volatility} />
          </section>
        )}

        {functionInfo && (
          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-2">Arguments</h2>
            <FunctionArgumentList arguments={parsedArgs} />
          </section>
        )}

        {dependencies && dependencies.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-2">Dependencies</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {dependencies.map((dep, idx) => {
                const displayName = dep.arguments
                  ? `${dep.schema}.${dep.name}(${dep.arguments})`
                  : `${dep.schema}.${dep.name}`
                return (
                  <span key={idx} className="inline-flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      {dep.type.replace('_', ' ')}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => onViewSchema?.(dep.schema, dep.name, dep.type as ObjectType, dep.arguments || undefined)}
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {displayName}
                    </button>
                  </span>
                )
              })}
            </div>
          </section>
        )}

        {functionInfo?.definition && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <h2 className="text-sm font-medium text-gray-700">Definition</h2>
                <Button variant="ghost" size="xs" onClick={handleCopyDefinition}>
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Clipboard className="w-3.5 h-3.5 text-gray-500" />
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={!hasAIProvider}
                        onClick={() => onExplainWithAI?.(functionInfo.definition)}
                      />
                    }
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                    Explain
                  </TooltipTrigger>
                  {!hasAIProvider && (
                    <TooltipPopup side="bottom">
                      Configure an AI provider in pgconsole.toml to enable this feature
                    </TooltipPopup>
                  )}
                </Tooltip>
                {hasDdl && (
                  <Button variant="outline" size="xs" onClick={() => setShowEditModal(true)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
            <SQLDefinition sql={functionInfo.definition} />
          </section>
        )}

        {functionInfo?.comment && (
          <section>
            <h2 className="text-sm font-medium text-gray-700 mb-1">Comment</h2>
            <div className="text-sm text-gray-600">{functionInfo.comment}</div>
          </section>
        )}
      </div>

      <EditDefinitionModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setApplyError(null)
        }}
        onApply={handleApplyChanges}
        original={functionInfo?.definition ?? ''}
        objectType={objectType}
        isApplying={executeSQL.isPending}
        applyError={applyError}
      />
    </ScrollArea>
  )
}
