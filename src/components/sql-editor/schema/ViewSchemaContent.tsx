import { useColumns, useTableInfo } from '../../../hooks/useQuery'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { ScrollArea } from '../../ui/scroll-area'
import { InfoItem, formatBytes, formatRowCount, getKindLabel, SQLDefinition, ColumnsTable } from './shared'

interface ViewSchemaContentProps {
  connectionId: string
  schema: string
  view: string
  objectType: 'view' | 'materialized_view'
  onNewQuery?: (content?: string) => void
}

export function ViewSchemaContent({ connectionId, schema, view, objectType, onNewQuery }: ViewSchemaContentProps) {
  const { data: columns, isLoading: columnsLoading } = useColumns(connectionId, schema, view)
  const { data: tableInfo, isLoading: tableInfoLoading } = useTableInfo(connectionId, schema, view)

  const handleNewQuery = () => {
    onNewQuery?.(`SELECT * FROM "${schema}"."${view}" LIMIT 100;`)
  }

  const isMaterializedView = objectType === 'materialized_view'
  const kind = tableInfo?.kind || objectType

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{view}</h1>
          <Badge variant="secondary">{schema}</Badge>
          <Badge variant="muted">{getKindLabel(kind)}</Badge>
          <Button variant="outline" size="xs" onClick={handleNewQuery}>
            New Query
          </Button>
        </div>

        <section>
          {tableInfoLoading ? (
            <div className="text-sm text-gray-500">Loading...</div>
          ) : tableInfo ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <InfoItem label="Owner" value={tableInfo.owner} />
              {isMaterializedView && (
                <>
                  <InfoItem label="Rows (est.)" value={formatRowCount(tableInfo.rowCount)} />
                  <InfoItem label="Total Size" value={formatBytes(tableInfo.totalSize)} />
                  <InfoItem label="Table Size" value={formatBytes(tableInfo.tableSize)} />
                  <InfoItem label="Index Size" value={formatBytes(tableInfo.indexSize)} />
                </>
              )}
              <InfoItem label="Encoding" value={tableInfo.encoding} />
              <InfoItem label="Collation" value={tableInfo.collation} />
              {tableInfo.comment && (
                <div className="col-span-2 md:col-span-4">
                  <div className="text-gray-500">Comment</div>
                  <div>{tableInfo.comment}</div>
                </div>
              )}
            </div>
          ) : null}
        </section>

        <section>
          <ColumnsTable columns={columns} isLoading={columnsLoading} />
        </section>

        {tableInfo?.definition && (
          <SQLDefinition sql={tableInfo.definition} />
        )}
      </div>
    </ScrollArea>
  )
}
