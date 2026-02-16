import type { ObjectType } from './ObjectTree'
import { TableSchemaContent } from './schema/TableSchemaContent'
import { ViewSchemaContent } from './schema/ViewSchemaContent'
import { FunctionSchemaContent } from './schema/FunctionSchemaContent'

interface SchemaTabContentProps {
  connectionId: string
  schema: string
  table: string
  objectType?: ObjectType
  arguments?: string
  onNewQuery?: (content?: string) => void
  onViewSchema?: (schema: string, objectName: string, objectType: ObjectType, args?: string) => void
  onExplainWithAI?: (sql: string) => void
}

export function SchemaTabContent({
  connectionId,
  schema,
  table,
  objectType,
  arguments: args,
  onNewQuery,
  onViewSchema,
  onExplainWithAI,
}: SchemaTabContentProps) {
  if (objectType === 'function' || objectType === 'procedure') {
    return (
      <FunctionSchemaContent
        connectionId={connectionId}
        schema={schema}
        name={table}
        objectType={objectType}
        arguments={args}
        onViewSchema={onViewSchema}
        onExplainWithAI={onExplainWithAI}
      />
    )
  }

  if (objectType === 'view' || objectType === 'materialized_view') {
    return (
      <ViewSchemaContent
        connectionId={connectionId}
        schema={schema}
        view={table}
        objectType={objectType}
        onNewQuery={onNewQuery}
      />
    )
  }

  return (
    <TableSchemaContent
      connectionId={connectionId}
      schema={schema}
      table={table}
      onNewQuery={onNewQuery}
    />
  )
}
