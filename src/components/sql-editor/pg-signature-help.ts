/**
 * PostgreSQL Signature Help for CodeMirror
 * Shows function parameter hints as you type inside function parentheses.
 */

import { showTooltip, type Tooltip } from '@codemirror/view'
import { StateField } from '@codemirror/state'
import { schemaStore } from '@/lib/schema-store'

interface FunctionContext {
  name: string
  startPos: number
  argIndex: number
}

const NON_FUNCTION_KEYWORDS = new Set(['IF', 'IN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AND', 'OR', 'NOT'])

/**
 * Finds the function context at the cursor position.
 */
function getFunctionContext(doc: string, cursor: number): FunctionContext | null {
  let parenDepth = 0
  let argIndex = 0
  let openParenPos = -1
  let inString: string | null = null

  for (let i = cursor - 1; i >= 0; i--) {
    const char = doc[i]
    const prevChar = i > 0 ? doc[i - 1] : ''

    if ((char === "'" || char === '"') && prevChar !== '\\') {
      if (inString === char) {
        inString = null
      } else if (!inString) {
        inString = char
      }
      continue
    }

    if (inString) continue

    if (char === ')') {
      parenDepth++
    } else if (char === '(') {
      if (parenDepth === 0) {
        openParenPos = i
        break
      }
      parenDepth--
    } else if (char === ',' && parenDepth === 0) {
      argIndex++
    } else if (char === ';') {
      break
    }
  }

  if (openParenPos === -1) return null

  let nameEnd = openParenPos
  let nameStart = nameEnd

  while (nameStart > 0 && /\s/.test(doc[nameStart - 1])) {
    nameStart--
    nameEnd = nameStart
  }

  while (nameStart > 0 && /[\w_]/.test(doc[nameStart - 1])) {
    nameStart--
  }

  if (nameStart === nameEnd) return null

  const name = doc.slice(nameStart, nameEnd)
  if (!/^[a-zA-Z_]\w*$/.test(name)) return null
  if (NON_FUNCTION_KEYWORDS.has(name.toUpperCase())) return null

  return { name, startPos: openParenPos, argIndex }
}

/**
 * Get function signature from schema store.
 */
function getFunctionSignature(name: string): string | undefined {
  const functions = schemaStore.getFunctions()
  const fn = functions.find(f => f.name.toLowerCase() === name.toLowerCase())
  return fn?.arguments
}

/**
 * Parse signature string into individual arguments.
 */
function parseSignatureArgs(signature: string): string[] {
  if (!signature) return []

  const args: string[] = []
  let current = ''
  let parenDepth = 0

  for (const char of signature) {
    if (char === '(') {
      parenDepth++
      current += char
    } else if (char === ')') {
      parenDepth--
      current += char
    } else if (char === ',' && parenDepth === 0) {
      if (current.trim()) args.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  if (current.trim()) args.push(current.trim())
  return args
}

/**
 * Creates the signature help tooltip content.
 */
function createSignatureTooltip(context: FunctionContext): HTMLElement {
  const container = document.createElement('div')
  container.className = 'cm-signature-help'

  const signature = getFunctionSignature(context.name)
  if (!signature) return container

  const sigLine = document.createElement('div')
  sigLine.className = 'cm-signature-help-signature'

  const nameSpan = document.createElement('span')
  nameSpan.className = 'cm-signature-help-name'
  nameSpan.textContent = context.name
  sigLine.appendChild(nameSpan)
  sigLine.appendChild(document.createTextNode('('))

  const args = parseSignatureArgs(signature)
  args.forEach((arg, i) => {
    if (i > 0) sigLine.appendChild(document.createTextNode(', '))
    const argSpan = document.createElement('span')
    argSpan.className = i === context.argIndex
      ? 'cm-signature-help-arg cm-signature-help-arg-active'
      : 'cm-signature-help-arg'
    argSpan.textContent = arg
    sigLine.appendChild(argSpan)
  })

  sigLine.appendChild(document.createTextNode(')'))
  container.appendChild(sigLine)

  return container
}

const signatureHelpState = StateField.define<FunctionContext | null>({
  create: () => null,
  update(value, tr) {
    if (tr.docChanged || tr.selection) {
      return getFunctionContext(tr.state.doc.toString(), tr.state.selection.main.head)
    }
    return value
  },
})

const signatureHelpTooltip = StateField.define<readonly Tooltip[]>({
  create: () => [],
  update(_, tr) {
    const context = tr.state.field(signatureHelpState)
    if (!context) return []

    const signature = getFunctionSignature(context.name)
    if (!signature) return []

    return [{
      pos: context.startPos + 1,
      above: true,
      strictSide: true,
      arrow: false,
      create: () => ({ dom: createSignatureTooltip(context) }),
    }]
  },
  provide: f => showTooltip.computeN([f], state => state.field(f)),
})

export function pgSignatureHelp() {
  return [signatureHelpState, signatureHelpTooltip]
}
