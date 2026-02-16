import { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { pgHighlight } from '../pg-highlight'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../../ui/table'

export function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-gray-500">{label}</div>
      <div>{value || '-'}</div>
    </div>
  )
}

export function formatBytes(bytes: bigint | number): string {
  const n = Number(bytes)
  if (n === 0) return '0 B'
  const i = Math.floor(Math.log(n) / Math.log(1024))
  return (n / Math.pow(1024, i)).toFixed(1) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i]
}

export function formatRowCount(count: bigint | number): string {
  const n = Number(count)
  if (n < 1000) return n.toString()
  if (n < 1e6) return (n / 1000).toFixed(1) + 'K'
  if (n < 1e9) return (n / 1e6).toFixed(1) + 'M'
  return (n / 1e9).toFixed(1) + 'B'
}

export function getKindLabel(kind: string | undefined): string {
  switch (kind) {
    case 'table': return 'Table'
    case 'partitioned_table': return 'Partitioned Table'
    case 'view': return 'View'
    case 'materialized_view': return 'Materialized View'
    case 'function': return 'Function'
    case 'procedure': return 'Procedure'
    default: return 'Object'
  }
}

interface Column {
  name: string
  type: string
  nullable: boolean
}

interface ColumnsTableProps {
  columns: Column[] | undefined
  isLoading: boolean
}

export function ColumnsTable({ columns, isLoading }: ColumnsTableProps) {
  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading...</div>
  }

  if (!columns || columns.length === 0) {
    return <div className="text-sm text-gray-500">No columns</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Nullable</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {columns.map((col) => (
          <TableRow key={col.name}>
            <TableCell>{col.name}</TableCell>
            <TableCell className="text-gray-600">{col.type}</TableCell>
            <TableCell>{col.nullable ? 'Yes' : 'No'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

interface Index {
  name: string
  isUnique: boolean
  isPrimary: boolean
  method: string
  columns: string[]
}

interface IndexesTableProps {
  indexes: Index[] | undefined
  isLoading: boolean
}

export function IndexesTable({ indexes, isLoading }: IndexesTableProps) {
  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading...</div>
  }

  if (!indexes || indexes.length === 0) {
    return <div className="text-sm text-gray-500">No indexes</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Columns</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Method</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {indexes.map((idx) => (
          <TableRow key={idx.name}>
            <TableCell>{idx.name}</TableCell>
            <TableCell className="text-gray-600">{idx.columns.join(', ')}</TableCell>
            <TableCell>{idx.isPrimary ? 'Primary' : idx.isUnique ? 'Unique' : '-'}</TableCell>
            <TableCell className="text-gray-600">{idx.method}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

interface Constraint {
  name: string
  type: string
  columns: string[]
  definition: string
  refTable: string
  refColumns: string[]
}

interface ConstraintsTableProps {
  constraints: Constraint[] | undefined
  isLoading: boolean
}

export function ConstraintsTable({ constraints, isLoading }: ConstraintsTableProps) {
  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading...</div>
  }

  if (!constraints || constraints.length === 0) {
    return <div className="text-sm text-gray-500">No constraints</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Columns</TableHead>
          <TableHead>References</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {constraints.map((con) => (
          <TableRow key={con.name}>
            <TableCell>{con.name}</TableCell>
            <TableCell>{con.type}</TableCell>
            <TableCell className="text-gray-600">
              {con.type === 'CHECK' ? con.definition : con.columns.join(', ')}
            </TableCell>
            <TableCell className="text-gray-600">
              {con.refTable ? `${con.refTable} (${con.refColumns.join(', ')})` : '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

interface Trigger {
  name: string
  timing: string
  event: string
  level: string
  function: string
  enabled: boolean
}

interface TriggersTableProps {
  triggers: Trigger[] | undefined
  isLoading: boolean
}

export function TriggersTable({ triggers, isLoading }: TriggersTableProps) {
  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading...</div>
  }

  if (!triggers || triggers.length === 0) {
    return <div className="text-sm text-gray-500">No triggers</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Timing</TableHead>
          <TableHead>Event</TableHead>
          <TableHead>Level</TableHead>
          <TableHead>Function</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {triggers.map((trg) => (
          <TableRow key={trg.name} className={trg.enabled ? '' : 'opacity-50'}>
            <TableCell>{trg.name}</TableCell>
            <TableCell>{trg.timing}</TableCell>
            <TableCell>{trg.event}</TableCell>
            <TableCell>{trg.level}</TableCell>
            <TableCell className="text-gray-600">{trg.function}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

interface Policy {
  name: string
  command: string
  permissive: string
  roles: string[]
  usingExpr: string
  checkExpr: string
}

interface PoliciesTableProps {
  policies: Policy[] | undefined
  isLoading: boolean
}

export function PoliciesTable({ policies, isLoading }: PoliciesTableProps) {
  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading...</div>
  }

  if (!policies || policies.length === 0) {
    return <div className="text-sm text-gray-500">No policies</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Command</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Roles</TableHead>
          <TableHead>Expression</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {policies.map((pol) => (
          <TableRow key={pol.name}>
            <TableCell>{pol.name}</TableCell>
            <TableCell>{pol.command}</TableCell>
            <TableCell>{pol.permissive}</TableCell>
            <TableCell className="text-gray-600">{pol.roles.join(', ')}</TableCell>
            <TableCell className="text-gray-600 font-mono text-xs max-w-xs truncate" title={pol.usingExpr || pol.checkExpr}>
              {pol.usingExpr || pol.checkExpr || '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

interface Grant {
  grantee: string
  privileges: string[]
  grantor: string
}

interface GrantsTableProps {
  grants: Grant[] | undefined
  isLoading: boolean
}

export function GrantsTable({ grants, isLoading }: GrantsTableProps) {
  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading...</div>
  }

  if (!grants || grants.length === 0) {
    return <div className="text-sm text-gray-500">No grants</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Grantee</TableHead>
          <TableHead>Privileges</TableHead>
          <TableHead>Grantor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {grants.map((grant) => (
          <TableRow key={`${grant.grantee}-${grant.grantor}`}>
            <TableCell>{grant.grantee}</TableCell>
            <TableCell className="text-gray-600">{grant.privileges.join(', ')}</TableCell>
            <TableCell className="text-gray-600">{grant.grantor}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export const editorTheme = (isEditing = false) => EditorView.theme({
  '&': { fontSize: '13px' },
  '.cm-content': { padding: '8px 12px', fontFamily: 'ui-monospace, monospace' },
  '.cm-line': { padding: '0' },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-gutters': { backgroundColor: isEditing ? '#fff' : '#f9fafb', borderRight: '1px solid #e5e7eb' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px', color: '#9ca3af' },
})

export function useSqlModuleReady() {
  const [moduleReady, setModuleReady] = useState(false)
  useEffect(() => {
    import('@/lib/sql').then(({ ensureModuleLoaded }) => {
      ensureModuleLoaded().then(() => setModuleReady(true))
    })
  }, [])
  return moduleReady
}

export function SQLDefinition({ sql }: { sql: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const moduleReady = useSqlModuleReady()

  useEffect(() => {
    if (!containerRef.current || !moduleReady) return

    if (viewRef.current) {
      viewRef.current.destroy()
      viewRef.current = null
    }

    const state = EditorState.create({
      doc: sql,
      extensions: [
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        lineNumbers(),
        pgHighlight(),
        editorTheme(),
      ],
    })

    viewRef.current = new EditorView({ state, parent: containerRef.current })

    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [sql, moduleReady])

  return <div ref={containerRef} className="bg-gray-50 rounded-md overflow-hidden border border-gray-200" />
}
