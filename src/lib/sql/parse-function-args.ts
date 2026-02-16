/**
 * Parse PostgreSQL function argument strings into structured form.
 *
 * Handles formats like:
 * - `p_id integer` → `{ mode: null, name: 'p_id', type: 'integer', defaultValue: null }`
 * - `IN p_id integer DEFAULT 10` → `{ mode: 'IN', name: 'p_id', type: 'integer', defaultValue: '10' }`
 * - `OUT result text` → `{ mode: 'OUT', name: 'result', type: 'text', defaultValue: null }`
 * - `VARIADIC args text[]` → `{ mode: 'VARIADIC', name: 'args', type: 'text[]', defaultValue: null }`
 * - `integer` → `{ mode: null, name: null, type: 'integer', defaultValue: null }` (unnamed arg)
 */

export interface FunctionArgument {
  mode: 'IN' | 'OUT' | 'INOUT' | 'VARIADIC' | null
  name: string | null
  type: string
  defaultValue: string | null
}

const ARG_MODES = ['IN', 'OUT', 'INOUT', 'VARIADIC']

/**
 * Parse a PostgreSQL function arguments string into structured arguments.
 * The input is the comma-separated list of arguments (without parentheses).
 */
export function parseFunctionArguments(argsString: string): FunctionArgument[] {
  if (!argsString || !argsString.trim()) {
    return []
  }

  // Split by comma, but respect nested parentheses and quotes
  const argStrings = splitArguments(argsString)

  return argStrings.map(parseOneArgument)
}

/**
 * Split argument string by commas, respecting parentheses and quotes.
 */
function splitArguments(argsString: string): string[] {
  const args: string[] = []
  let current = ''
  let depth = 0
  let inString = false
  let stringChar = ''

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i]

    if (inString) {
      current += char
      if (char === stringChar && argsString[i - 1] !== '\\') {
        inString = false
      }
      continue
    }

    if (char === "'" || char === '"') {
      inString = true
      stringChar = char
      current += char
      continue
    }

    if (char === '(' || char === '[') {
      depth++
      current += char
      continue
    }

    if (char === ')' || char === ']') {
      depth--
      current += char
      continue
    }

    if (char === ',' && depth === 0) {
      args.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  if (current.trim()) {
    args.push(current.trim())
  }

  return args
}

/**
 * Parse a single argument definition.
 */
function parseOneArgument(argStr: string): FunctionArgument {
  let str = argStr.trim()
  if (!str) {
    return { mode: null, name: null, type: '', defaultValue: null }
  }

  let mode: FunctionArgument['mode'] = null
  let name: string | null = null
  let type = ''
  let defaultValue: string | null = null

  // Check for mode prefix (IN, OUT, INOUT, VARIADIC)
  const upperStr = str.toUpperCase()
  for (const m of ARG_MODES) {
    if (upperStr.startsWith(m + ' ')) {
      mode = m as FunctionArgument['mode']
      str = str.slice(m.length).trim()
      break
    }
  }

  // Extract default value (look for DEFAULT keyword)
  const defaultMatch = str.match(/\s+DEFAULT\s+(.+)$/i)
  if (defaultMatch) {
    defaultValue = defaultMatch[1].trim()
    str = str.slice(0, str.length - defaultMatch[0].length).trim()
  }

  // Also check for = syntax for defaults
  const equalMatch = str.match(/\s*=\s*(.+)$/)
  if (equalMatch && !defaultValue) {
    defaultValue = equalMatch[1].trim()
    str = str.slice(0, str.length - equalMatch[0].length).trim()
  }

  // Now we have either "name type" or just "type"
  // Types can be complex: "character varying(100)", "numeric(10,2)", "text[]"
  // Names are simple identifiers

  // Try to detect if first word is a name by seeing if the rest looks like a valid type
  const parts = splitNameAndType(str)

  if (parts.name) {
    name = parts.name
    type = parts.type
  } else {
    type = str
  }

  return { mode, name, type, defaultValue }
}

/**
 * Try to split "name type" from a string, handling complex types.
 */
function splitNameAndType(str: string): { name: string | null; type: string } {
  // Common PostgreSQL types (lowercase for comparison)
  const commonTypes = [
    'integer', 'int', 'int4', 'int8', 'int2', 'smallint', 'bigint',
    'text', 'varchar', 'char', 'character', 'bpchar',
    'boolean', 'bool',
    'numeric', 'decimal', 'real', 'float', 'float4', 'float8', 'double',
    'timestamp', 'timestamptz', 'date', 'time', 'timetz', 'interval',
    'uuid', 'json', 'jsonb', 'xml',
    'bytea', 'bit', 'varbit',
    'point', 'line', 'lseg', 'box', 'path', 'polygon', 'circle',
    'inet', 'cidr', 'macaddr', 'macaddr8',
    'money', 'oid', 'regproc', 'regprocedure', 'regoper', 'regoperator',
    'regclass', 'regtype', 'regrole', 'regnamespace', 'regconfig', 'regdictionary',
    'void', 'record', 'trigger', 'event_trigger', 'anyelement', 'anyarray',
    'setof', 'array', 'table',
  ]

  const tokens = tokenizeArgument(str)

  if (tokens.length === 0) {
    return { name: null, type: '' }
  }

  if (tokens.length === 1) {
    // Just a type name
    return { name: null, type: tokens[0] }
  }

  // Check if first token looks like a type name
  const firstLower = tokens[0].toLowerCase()
  if (commonTypes.includes(firstLower)) {
    // First token is a type, so no name
    return { name: null, type: str }
  }

  // Otherwise, assume first token is the name and rest is the type
  const name = tokens[0]
  const typeStr = str.slice(str.indexOf(name) + name.length).trim()

  return { name, type: typeStr }
}

/**
 * Tokenize argument string into words, respecting parentheses.
 */
function tokenizeArgument(str: string): string[] {
  const tokens: string[] = []
  let current = ''
  let depth = 0

  for (let i = 0; i < str.length; i++) {
    const char = str[i]

    if (char === '(' || char === '[') {
      depth++
      current += char
      continue
    }

    if (char === ')' || char === ']') {
      depth--
      current += char
      continue
    }

    if (/\s/.test(char) && depth === 0) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current) {
    tokens.push(current)
  }

  return tokens
}

/**
 * Format an argument value for use in SQL.
 */
export function formatArgValue(value: string, type: string): string {
  if (!value || value.trim() === '') {
    return 'NULL'
  }

  const trimmed = value.trim()
  const typeLower = type.toLowerCase()

  // Handle NULL explicitly
  if (trimmed.toUpperCase() === 'NULL') {
    return 'NULL'
  }

  // String-like types need quoting
  const stringTypes = ['text', 'varchar', 'char', 'character', 'bpchar', 'uuid', 'json', 'jsonb', 'xml', 'bytea', 'name']
  if (stringTypes.some(t => typeLower.includes(t))) {
    // Escape single quotes
    return `'${trimmed.replace(/'/g, "''")}'`
  }

  // Date/time types need quoting
  const dateTypes = ['timestamp', 'date', 'time', 'interval']
  if (dateTypes.some(t => typeLower.includes(t))) {
    return `'${trimmed.replace(/'/g, "''")}'`
  }

  // Boolean
  if (typeLower === 'boolean' || typeLower === 'bool') {
    const lower = trimmed.toLowerCase()
    if (lower === 'true' || lower === 't' || lower === '1') {
      return 'TRUE'
    }
    if (lower === 'false' || lower === 'f' || lower === '0') {
      return 'FALSE'
    }
    return trimmed
  }

  // Arrays - user provides literal like {1,2,3} or ARRAY[1,2,3]
  if (typeLower.includes('[]') || typeLower.startsWith('array')) {
    if (trimmed.startsWith('{') || trimmed.toUpperCase().startsWith('ARRAY')) {
      // Already formatted as array literal
      if (trimmed.startsWith('{')) {
        return `'${trimmed}'`
      }
      return trimmed
    }
    return trimmed
  }

  // Numeric types - return as-is
  return trimmed
}
