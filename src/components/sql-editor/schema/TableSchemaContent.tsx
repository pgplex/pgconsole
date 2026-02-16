import { useEffect, useMemo, useState } from 'react'
import { renderMermaid } from 'beautiful-mermaid'
import { useColumns, useConstraints, useGrants, useIndexes, usePolicies, useTableInfo, useTriggers } from '../../../hooks/useQuery'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { ScrollArea } from '../../ui/scroll-area'
import { Tabs, TabsList, TabsTab, TabsPanel } from '../../ui/tabs'
import { InfoItem, formatBytes, formatRowCount, getKindLabel, ColumnsTable, IndexesTable, ConstraintsTable, TriggersTable, PoliciesTable, GrantsTable } from './shared'

interface TableSchemaContentProps {
  connectionId: string
  schema: string
  table: string
  onNewQuery?: (content?: string) => void
}

type TabValue = 'columns' | 'indexes' | 'constraints' | 'triggers' | 'policies' | 'grants'

export function TableSchemaContent({ connectionId, schema, table, onNewQuery }: TableSchemaContentProps) {
  const [visitedTabs, setVisitedTabs] = useState<Set<TabValue>>(new Set(['columns']))

  const handleTabChange = (value: TabValue) => {
    setVisitedTabs(prev => new Set(prev).add(value))
  }

  // Always load columns (default tab) and tableInfo (header)
  const { data: columns, isLoading: columnsLoading } = useColumns(connectionId, schema, table)
  const { data: tableInfo, isLoading: tableInfoLoading } = useTableInfo(connectionId, schema, table)

  // Lazy load other tabs (constraints always eager for ER diagram)
  const { data: indexes, isLoading: indexesLoading } = useIndexes(connectionId, schema, table, visitedTabs.has('indexes'))
  const { data: constraintData, isLoading: constraintsLoading } = useConstraints(connectionId, schema, table, true)
  const constraints = constraintData?.constraints
  const referencedBy = constraintData?.referencedBy
  const { data: triggers, isLoading: triggersLoading } = useTriggers(connectionId, schema, table, visitedTabs.has('triggers'))
  const { data: policies, isLoading: policiesLoading } = usePolicies(connectionId, schema, table, visitedTabs.has('policies'))
  const { data: grants, isLoading: grantsLoading } = useGrants(connectionId, schema, table, visitedTabs.has('grants'))

  const handleNewQuery = () => {
    onNewQuery?.(`SELECT * FROM "${schema}"."${table}" LIMIT 100;`)
  }

  // Build ER diagram showing table structure and FK relationships
  const erDiagram = useMemo(() => {
    if (!columns) return null

    const fks = constraints?.filter((c) => c.type === 'FOREIGN KEY' && c.refTable) ?? []

    // Mermaid identifiers must be alphanumeric + underscore
    const sanitize = (s: string) => s.replace(/\[\]/g, '_arr').replace(/[^a-zA-Z0-9_]/g, '_')

    const fkColumnNames = new Set(fks.flatMap((fk) => fk.columns))
    const pkColumnNames = new Set(
      constraints?.filter((c) => c.type === 'PRIMARY KEY').flatMap((c) => c.columns) ?? []
    )

    const lines: string[] = ['erDiagram']
    const tableName = sanitize(table)

    // Current table with all columns
    lines.push(`  ${tableName} {`)
    for (const col of columns) {
      const markers: string[] = []
      if (pkColumnNames.has(col.name)) markers.push('PK')
      if (fkColumnNames.has(col.name)) markers.push('FK')
      lines.push(`    ${sanitize(col.type)} ${sanitize(col.name)}${markers.length ? ' ' + markers.join(',') : ''}`)
    }
    lines.push('  }')

    // Collect key columns for related tables (no extra RPC needed)
    // Map: sanitized table name -> array of { colName, marker }
    const relatedCols = new Map<string, Map<string, string>>()
    const addRelatedCol = (tbl: string, col: string, marker: string) => {
      if (!relatedCols.has(tbl)) relatedCols.set(tbl, new Map())
      const cols = relatedCols.get(tbl)!
      if (!cols.has(col)) cols.set(col, marker)
    }

    // Forward FK relationships (this table references other tables)
    for (const fk of fks) {
      const refRaw = fk.refTable.startsWith(schema + '.')
        ? fk.refTable.slice(schema.length + 1)
        : fk.refTable
      const refName = sanitize(refRaw)
      for (const col of fk.refColumns) addRelatedCol(refName, col, 'PK')
      lines.push(`  ${refName} ||--o{ ${tableName} : "${fk.name}"`)
    }

    // Reverse FK relationships (other tables reference this table)
    const reverseFks = referencedBy ?? []
    for (const fk of reverseFks) {
      const srcRaw = fk.refTable.startsWith(schema + '.')
        ? fk.refTable.slice(schema.length + 1)
        : fk.refTable
      const srcName = sanitize(srcRaw)
      for (const col of fk.columns) addRelatedCol(srcName, col, 'FK')
      lines.push(`  ${tableName} ||--o{ ${srcName} : "${fk.name}"`)
    }

    // Render related table entities with just their key columns
    for (const [tbl, cols] of relatedCols) {
      lines.push(`  ${tbl} {`)
      for (const [col, marker] of cols) {
        lines.push(`    _ ${sanitize(col)} ${marker}`)
      }
      lines.push('  }')
    }

    return lines.join('\n')
  }, [columns, constraints, referencedBy, table, schema])

  const [erSvg, setErSvg] = useState<string | null>(null)

  useEffect(() => {
    if (!erDiagram) {
      setErSvg(null)
      return
    }
    let cancelled = false
    const style = getComputedStyle(document.documentElement)
    const fg = style.getPropertyValue('--foreground').trim()
    const muted = style.getPropertyValue('--muted-foreground').trim()
    renderMermaid(erDiagram, { transparent: true, fg, muted })
      .then((svg) => { if (!cancelled) setErSvg(svg) })
      .catch(() => { if (!cancelled) setErSvg(null) })
    return () => { cancelled = true }
  }, [erDiagram])

  const kind = tableInfo?.kind || 'table'

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{table}</h1>
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
              <InfoItem label="Rows (est.)" value={formatRowCount(tableInfo.rowCount)} />
              <InfoItem label="Total Size" value={formatBytes(tableInfo.totalSize)} />
              <InfoItem label="Table Size" value={formatBytes(tableInfo.tableSize)} />
              <InfoItem label="Index Size" value={formatBytes(tableInfo.indexSize)} />
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

        {erSvg && (
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2">Entity Diagram</h3>
            <div
              className="border rounded-lg p-4 flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: erSvg }}
            />
          </section>
        )}

        <Tabs defaultValue="columns" className="flex-1" onValueChange={(value) => handleTabChange(value as TabValue)}>
          <TabsList variant="underline">
            <TabsTab value="columns">Columns</TabsTab>
            <TabsTab value="indexes">Indexes</TabsTab>
            <TabsTab value="constraints">Constraints</TabsTab>
            <TabsTab value="triggers">Triggers</TabsTab>
            <TabsTab value="policies">Policies</TabsTab>
            <TabsTab value="grants">Grants</TabsTab>
          </TabsList>
          <TabsPanel value="columns" className="pt-4">
            <ColumnsTable columns={columns} isLoading={columnsLoading} />
          </TabsPanel>
          <TabsPanel value="indexes" className="pt-4">
            <IndexesTable indexes={indexes} isLoading={indexesLoading} />
          </TabsPanel>
          <TabsPanel value="constraints" className="pt-4">
            <ConstraintsTable constraints={constraints} isLoading={constraintsLoading} />
          </TabsPanel>
          <TabsPanel value="triggers" className="pt-4">
            <TriggersTable triggers={triggers} isLoading={triggersLoading} />
          </TabsPanel>
          <TabsPanel value="policies" className="pt-4">
            <PoliciesTable policies={policies} isLoading={policiesLoading} />
          </TabsPanel>
          <TabsPanel value="grants" className="pt-4">
            <GrantsTable grants={grants} isLoading={grantsLoading} />
          </TabsPanel>
        </Tabs>
      </div>
    </ScrollArea>
  )
}
