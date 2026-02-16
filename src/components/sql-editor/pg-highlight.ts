import { ViewPlugin, Decoration, type DecorationSet, type ViewUpdate, EditorView } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { tokenize, ensureModuleLoaded, isModuleLoaded } from '@/lib/sql'

// Cache decorations by class name
const decorationCache = new Map<string, Decoration>()
function getDecoration(className: string): Decoration {
  let decoration = decorationCache.get(className)
  if (!decoration) {
    decoration = Decoration.mark({ class: className })
    decorationCache.set(className, decoration)
  }
  return decoration
}

function buildDecorations(view: EditorView): DecorationSet {
  if (!isModuleLoaded()) {
    return Decoration.none
  }

  const tokens = tokenize(view.state.doc.toString())
  if (tokens.length === 0) {
    return Decoration.none
  }

  const builder = new RangeSetBuilder<Decoration>()
  for (const token of tokens) {
    if (token.from < token.to) {
      builder.add(token.from, token.to, getDecoration(token.class))
    }
  }
  return builder.finish()
}

// ViewPlugin that manages syntax highlighting
const pgHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    needsRebuild: boolean = false

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)

      if (!isModuleLoaded()) {
        ensureModuleLoaded().then(() => {
          this.needsRebuild = true
          // Dispatch empty transaction to trigger update cycle
          view.dispatch({})
        })
      }
    }

    update(update: ViewUpdate) {
      if (update.docChanged || this.needsRebuild) {
        this.decorations = buildDecorations(update.view)
        this.needsRebuild = false
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)

// Export the plugin (colors are defined in global CSS)
export function pgHighlight() {
  return pgHighlightPlugin
}
