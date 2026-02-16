export interface TableInfo {
  name: string
  schema: string
  type: 'table' | 'view'
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
}

export interface FunctionInfo {
  name: string
  schema: string
  arguments: string
  returnType?: string // Only for functions, not procedures
  kind: 'function' | 'procedure'
}

interface SchemaData {
  tables: TableInfo[]
  functions: FunctionInfo[]
}

interface SelectedTable {
  schema: string
  name: string
}

interface SchemaStoreState {
  connectionId: string | null
  selectedSchema: string | null
  selectedTable: SelectedTable | null
  schemas: Map<string, SchemaData>
  columns: Map<string, ColumnInfo[]>
  isLoaded: boolean
}

const state: SchemaStoreState = {
  connectionId: null,
  selectedSchema: null,
  selectedTable: null,
  schemas: new Map(),
  columns: new Map(),
  isLoaded: false,
}

export const schemaStore = {
  // Setters
  setConnection(connectionId: string) {
    if (state.connectionId !== connectionId) {
      state.connectionId = connectionId
      state.schemas.clear()
      state.columns.clear()
      state.isLoaded = false
    }
  },

  setSelectedSchema(schema: string) {
    state.selectedSchema = schema
  },

  setSelectedTable(table: { schema: string; name: string } | null) {
    state.selectedTable = table
  },

  setSchemas(schemaNames: string[]) {
    for (const name of schemaNames) {
      if (!state.schemas.has(name)) {
        state.schemas.set(name, { tables: [], functions: [] })
      }
    }
  },

  setTables(schema: string, tables: Array<{ name: string; type: string }>) {
    const schemaData = state.schemas.get(schema) || { tables: [], functions: [] }
    schemaData.tables = tables.map(t => ({
      name: t.name,
      schema,
      type: t.type as 'table' | 'view',
    }))
    state.schemas.set(schema, schemaData)
  },

  setFunctions(schema: string, functions: Array<{ name: string; arguments: string; returnType?: string }>, kind: 'function' | 'procedure') {
    const schemaData = state.schemas.get(schema) || { tables: [], functions: [] }
    const newFunctions = functions.map(f => ({
      name: f.name,
      schema,
      arguments: f.arguments,
      returnType: f.returnType,
      kind,
    }))
    // Merge with existing functions of different kind
    const existingOtherKind = schemaData.functions.filter(f => f.kind !== kind)
    schemaData.functions = [...existingOtherKind, ...newFunctions]
    state.schemas.set(schema, schemaData)
  },

  setColumns(schema: string, table: string, columns: ColumnInfo[]) {
    state.columns.set(`${schema}.${table}`, columns)
  },

  setLoaded(loaded: boolean) {
    state.isLoaded = loaded
  },

  // Getters
  getConnectionId(): string | null {
    return state.connectionId
  },

  getSelectedSchema(): string | null {
    return state.selectedSchema
  },

  getSelectedTable(): { schema: string; name: string } | null {
    return state.selectedTable
  },

  getSchemas(): string[] {
    return Array.from(state.schemas.keys())
  },

  getTables(schema?: string): TableInfo[] {
    if (schema) {
      return state.schemas.get(schema)?.tables || []
    }
    const allTables: TableInfo[] = []
    for (const schemaData of state.schemas.values()) {
      allTables.push(...schemaData.tables)
    }
    return allTables
  },

  getFunctions(schema?: string): FunctionInfo[] {
    if (schema) {
      return state.schemas.get(schema)?.functions || []
    }
    const allFunctions: FunctionInfo[] = []
    for (const schemaData of state.schemas.values()) {
      allFunctions.push(...schemaData.functions)
    }
    return allFunctions
  },

  getTableByName(name: string): TableInfo | null {
    if (state.selectedSchema) {
      const table = state.schemas.get(state.selectedSchema)?.tables.find(t => t.name === name)
      if (table) return table
    }
    for (const schemaData of state.schemas.values()) {
      const table = schemaData.tables.find(t => t.name === name)
      if (table) return table
    }
    return null
  },

  getColumns(schema: string, table: string): ColumnInfo[] | null {
    return state.columns.get(`${schema}.${table}`) || null
  },

  isDefaultSchema(schema: string): boolean {
    return schema === state.selectedSchema
  },

  isLoaded(): boolean {
    return state.isLoaded
  },
}
