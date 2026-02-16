import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clipboard, Check, Sparkles, ChevronDown, Database, ArrowLeftToLine, Play, Eraser, Send } from 'lucide-react'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { Menu, MenuTrigger, MenuPopup, MenuItem } from '../ui/menu'
import { Sheet, SheetTrigger, SheetBackdrop, SheetPopup, SheetTitle, SheetHeader, SheetPanel } from '../ui/sheet'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'
import { Checkbox } from '../ui/checkbox'
import { Tooltip, TooltipTrigger, TooltipPopup } from '../ui/tooltip'
import { aiClient, queryClient } from '@/lib/connect-client'
import { tokenize, parseSql } from '@/lib/sql'
import { SYNTAX_CORRECTION } from '@/lib/ai/prompts'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sql?: string
  error?: string
  isExplanation?: boolean // True if this is an explanation, not SQL generation
  auto?: boolean // True for auto-generated correction messages
}

interface ChatProps {
  connectionId: string
  onInsertSQL: (sql: string) => void
  onRunSQL: (sql: string) => void
  selectedSchema?: string // Current selected schema from the UI
  initialPrompt?: { sql: string; action: 'explain' } | null // Initial prompt to start conversation
  onInitialPromptProcessed?: () => void // Callback when initial prompt is processed
}

const AI_STORAGE_KEY = 'pgconsole-ai'

type SchemaMode = 'current' | 'all' | 'custom'

interface PersistedConnectionAISettings {
  provider: string
  schemaMode: SchemaMode
  customSchemas: string[]
}

interface PersistedAISettings {
  byConnection: Record<string, PersistedConnectionAISettings>
}

function loadAISettingsFromStorage(): PersistedAISettings {
  try {
    const stored = localStorage.getItem(AI_STORAGE_KEY)
    if (!stored) return { byConnection: {} }
    return JSON.parse(stored)
  } catch {
    return { byConnection: {} }
  }
}

function saveAISettingsToStorage(settings: PersistedAISettings) {
  try {
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage errors
  }
}

// Truncate SQL for display in chat (keeps full SQL for API)
// Clips in the middle to preserve opening and closing syntax for proper highlighting
function truncateSqlForDisplay(sql: string, maxLines = 10): string {
  const lines = sql.split('\n')
  if (lines.length <= maxLines) {
    return sql
  }
  // Keep more lines at start (opening syntax) and fewer at end (closing syntax)
  const startLines = Math.ceil(maxLines * 0.6)
  const endLines = maxLines - startLines
  const start = lines.slice(0, startLines).join('\n')
  const end = lines.slice(-endLines).join('\n')
  return `${start}\n...\n${end}`
}

// Abbreviate model names for compact display
function abbreviateModelName(name: string, model: string): string {
  // Use display name if it's already short
  if (name.length <= 15) return name

  // Extract key parts from model ID
  const modelLower = model.toLowerCase()

  if (modelLower.includes('claude')) {
    if (modelLower.includes('sonnet')) return 'Sonnet 4'
    if (modelLower.includes('haiku')) return 'Haiku'
    if (modelLower.includes('opus')) return 'Opus 4.5'
  }

  if (modelLower.includes('gpt-4o-mini')) return 'GPT-4o mini'
  if (modelLower.includes('gpt-4o')) return 'GPT-4o'
  if (modelLower.includes('gpt-4-turbo')) return 'GPT-4 Turbo'

  if (modelLower.includes('gemini-1.5-pro')) return 'Gemini 1.5 Pro'
  if (modelLower.includes('gemini-1.5-flash')) return 'Gemini 1.5 Flash'

  // Fallback: use display name
  return name
}

export function Chat({ connectionId, onInsertSQL, onRunSQL, selectedSchema, initialPrompt, onInitialPromptProcessed }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [schemaDrawerOpen, setSchemaDrawerOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [conversationMode, setConversationMode] = useState<'generate' | 'explain'>('generate')

  const [selectedProvider, setSelectedProvider] = useState<string>(() => {
    const settings = loadAISettingsFromStorage()
    return settings.byConnection[connectionId]?.provider ?? ''
  })

  const [schemaMode, setSchemaMode] = useState<SchemaMode>(() => {
    const settings = loadAISettingsFromStorage()
    return settings.byConnection[connectionId]?.schemaMode ?? 'current'
  })

  const [customSchemas, setCustomSchemas] = useState<string[]>(() => {
    const settings = loadAISettingsFromStorage()
    return settings.byConnection[connectionId]?.customSchemas ?? []
  })

  const { data: providersData, isLoading: isLoadingProviders } = useQuery({
    queryKey: ['ai', 'providers'],
    queryFn: () => aiClient.listAIProviders({}),
  })

  const { data: schemasData } = useQuery({
    queryKey: ['schemas', connectionId],
    queryFn: () => queryClient.getSchemas({ connectionId }),
  })

  const providers = providersData?.providers ?? []
  const availableSchemas = schemasData?.schemas ?? []

  // Auto-select first provider if none selected
  useEffect(() => {
    if (!selectedProvider && providers.length > 0) {
      setSelectedProvider(providers[0].id)
    }
  }, [providers, selectedProvider])

  // Persist AI settings to storage
  useEffect(() => {
    const settings = loadAISettingsFromStorage()
    settings.byConnection[connectionId] = {
      provider: selectedProvider,
      schemaMode,
      customSchemas,
    }
    saveAISettingsToStorage(settings)
  }, [selectedProvider, schemaMode, customSchemas, connectionId])

  // Memoize custom schemas for deep comparison in effect
  const customSchemasKey = useMemo(
    () => customSchemas.join(','),
    [customSchemas]
  )

  // Clear conversation when context changes (connection, provider, or schema selection)
  // to prevent stale references in the AI session
  useEffect(() => {
    setMessages([])
    setSessionId(null)
    setConversationMode('generate')
  }, [connectionId, selectedProvider, schemaMode, customSchemasKey])

  // Handle initial prompt (e.g., from "Explain with AI")
  useEffect(() => {
    if (!initialPrompt || !selectedProvider) return

    let cancelled = false

    const processInitialPrompt = async () => {
      // Clear existing conversation
      setMessages([])
      setSessionId(null)

      // Compute schemas to send based on current mode
      const schemas = (() => {
        if (schemaMode === 'current') {
          return selectedSchema ? [selectedSchema] : []
        } else if (schemaMode === 'all') {
          return availableSchemas
        } else {
          return customSchemas
        }
      })()

      if (initialPrompt.action === 'explain') {
        // Set conversation mode to explain
        setConversationMode('explain')

        const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: `Explain this SQL:\n\n\`\`\`sql\n${truncateSqlForDisplay(initialPrompt.sql)}\n\`\`\``,
        }

        setMessages([userMessage])
        setIsLoading(true)

        try {
          const response = await aiClient.explainSQL({
            connectionId,
            providerId: selectedProvider,
            sql: initialPrompt.sql,
            schemas,
            sessionId: '',
          })

          if (cancelled) return

          if (response.sessionId) {
            setSessionId(response.sessionId)
          }

          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: response.error ? 'Failed to explain SQL:' : response.explanation,
            error: response.error || undefined,
            isExplanation: true,
          }
          setMessages((prev) => [...prev, assistantMessage])
        } catch (err) {
          if (cancelled) return

          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'An error occurred:',
            error: err instanceof Error ? err.message : 'Unknown error',
            isExplanation: true,
          }
          setMessages((prev) => [...prev, assistantMessage])
        } finally {
          if (!cancelled) {
            setIsLoading(false)
            onInitialPromptProcessed?.()
          }
        }
      }
    }

    processInitialPrompt()

    return () => {
      cancelled = true
    }
  }, [initialPrompt, selectedProvider, connectionId, schemaMode, selectedSchema, availableSchemas, customSchemas, onInitialPromptProcessed])

  // Compute schemas to send to AI
  const schemasToSend = (() => {
    if (schemaMode === 'current') {
      return selectedSchema ? [selectedSchema] : []
    } else if (schemaMode === 'all') {
      return availableSchemas  // Send all schemas
    } else {
      return customSchemas
    }
  })()

  // Get context label for display
  const getContextLabel = () => {
    if (schemaMode === 'current') {
      return selectedSchema || 'No schema'
    }
    if (schemaMode === 'all') {
      return 'All schemas'
    }
    // custom mode
    if (customSchemas.length === 0) return 'No schemas'
    if (customSchemas.length === 1) return customSchemas[0]
    return `${customSchemas[0]} +${customSchemas.length - 1}`
  }

  // Get tooltip text for context selector
  const getContextTooltip = () => {
    if (schemaMode === 'current') return selectedSchema || 'No schema'
    if (schemaMode === 'all') return availableSchemas.join(', ')
    return customSchemas.length === 0 ? 'No schemas' : customSchemas.join(', ')
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading || !selectedProvider) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      if (conversationMode === 'explain') {
        // Use explainSQL endpoint for explanation conversations
        const response = await aiClient.explainSQL({
          connectionId,
          providerId: selectedProvider,
          sql: userMessage.content,
          schemas: schemasToSend,
          sessionId: sessionId || '',
        })

        // Store session ID from response
        if (response.sessionId) {
          setSessionId(response.sessionId)
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.error ? 'Failed to explain:' : response.explanation,
          error: response.error || undefined,
          isExplanation: true,
        }
        setMessages((prev) => [...prev, assistantMessage])
      } else {
        // Use generateSQL endpoint for SQL generation
        let currentSessionId = sessionId || ''
        let prompt = userMessage.content
        let isAutoRetry = false
        const MAX_AUTO_RETRIES = 2

        for (let attempt = 0; attempt <= MAX_AUTO_RETRIES; attempt++) {
          const response = await aiClient.generateSQL({
            connectionId,
            providerId: selectedProvider,
            prompt,
            schemas: schemasToSend,
            sessionId: currentSessionId,
          })

          // Store session ID from response
          if (response.sessionId) {
            currentSessionId = response.sessionId
            setSessionId(response.sessionId)
          }

          // If there's no SQL or there was an error, stop
          if (!response.sql || response.error) {
            const assistantMessage: Message = {
              id: (Date.now() + attempt * 2 + 1).toString(),
              role: 'assistant',
              content: response.error ? 'Failed to generate SQL:' : '',
              sql: undefined,
              error: response.error || undefined,
              auto: isAutoRetry,
            }
            setMessages((prev) => [...prev, assistantMessage])
            break
          }

          // Validate syntax first (if not last attempt)
          let parseError: Error | null = null
          if (attempt < MAX_AUTO_RETRIES) {
            try {
              await parseSql(response.sql)
            } catch (err) {
              parseError = err instanceof Error ? err : new Error('Unknown syntax error')
            }
          }

          // Use AI-generated SQL as-is (AI handles formatting)
          const assistantMessage: Message = {
            id: (Date.now() + attempt * 2 + 1).toString(),
            role: 'assistant',
            content: '',
            sql: response.sql,
            error: undefined,
            auto: isAutoRetry,
          }
          setMessages((prev) => [...prev, assistantMessage])

          // If validation passed, we're done
          if (!parseError) {
            break
          }

          // Validation failed - add correction message and retry
          const correctionMessage: Message = {
            id: (Date.now() + attempt * 2 + 2).toString(),
            role: 'user',
            content: SYNTAX_CORRECTION.user({ errorMessage: parseError.message }),
            auto: true,
          }
          setMessages((prev) => [...prev, correctionMessage])

          prompt = correctionMessage.content
          isAutoRetry = true
        }
      }
    } catch (err) {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'An error occurred:',
        error: err instanceof Error ? err.message : 'Unknown error',
      }
      setMessages((prev) => [...prev, assistantMessage])
      // Clear session ID on error (likely session expired)
      setSessionId(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClearConversation = () => {
    setMessages([])
    setSessionId(null)
    setConversationMode('generate')
  }

  // No providers configured (only show after loading completes)
  if (!isLoadingProviders && providers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Sparkles className="size-8 text-gray-300 mb-3" />
        <p className="text-sm text-gray-600 mb-2">AI features not configured</p>
        <p className="text-xs text-gray-400">
          <a
            href="https://docs.pgconsole.com/configuration/config#%5B%5Bai.providers%5D%5D"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Add an AI provider
          </a>
          {' '}to pgconsole.toml to enable Text-to-SQL generation.
        </p>
      </div>
    )
  }

  const currentProvider = providers.find((p) => p.id === selectedProvider)

  return (
    <div className="flex flex-col h-full">
      {/* Input area */}
      <div className="px-3 pt-3 pb-1.5 border-b border-gray-200">
        {/* Main text input */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the query you need..."
          className="w-full resize-none rounded-lg border border-gray-200 px-3 pt-2.5 text-sm focus:outline-none"
          rows={3}
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between">
            {/* Context selector */}
            <Tooltip>
              <Sheet open={schemaDrawerOpen} onOpenChange={setSchemaDrawerOpen}>
                <TooltipTrigger
                  render={
                    <SheetTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 font-normal text-gray-600 hover:text-gray-900 px-2 py-1 h-auto"
                        />
                      }
                    >
                      <Database className="size-3" />
                      <span className="text-xs">{getContextLabel()}</span>
                    </SheetTrigger>
                  }
                />
                <SheetBackdrop />
                <SheetPopup side="right" className="w-96">
                <SheetHeader>
                  <SheetTitle>Schema Context</SheetTitle>
                </SheetHeader>
                <SheetPanel>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-3">
                        Select which schemas to include in the AI context
                      </p>
                      <RadioGroup
                        value={schemaMode}
                        onValueChange={(value) => setSchemaMode(value as SchemaMode)}
                      >
                        <div className="space-y-3">
                          <label className="flex items-start gap-2 cursor-pointer">
                            <RadioGroupItem value="current" />
                            <div className="flex-1">
                              <div className="font-medium text-sm">Current schema</div>
                              <div className="text-xs text-gray-500">
                                {selectedSchema || 'No schema selected'}
                              </div>
                            </div>
                          </label>
                          <label className="flex items-start gap-2 cursor-pointer">
                            <RadioGroupItem value="all" />
                            <div className="flex-1">
                              <div className="font-medium text-sm">All schemas</div>
                              <div className="text-xs text-gray-500">
                                {availableSchemas.length} schema{availableSchemas.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </label>
                          <label className="flex items-start gap-2 cursor-pointer">
                            <RadioGroupItem value="custom" />
                            <div className="flex-1">
                              <div className="font-medium text-sm">Custom selection</div>
                              <div className="text-xs text-gray-500">
                                Choose specific schemas
                              </div>
                            </div>
                          </label>
                        </div>
                      </RadioGroup>
                    </div>

                    {schemaMode === 'custom' && (
                      <div className="space-y-2 pt-2 border-t">
                        <p className="text-sm font-medium">Select schemas:</p>
                        <div className="space-y-1.5">
                          {availableSchemas.map((schema) => (
                            <label key={schema} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={customSchemas.includes(schema)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setCustomSchemas([...customSchemas, schema])
                                  } else {
                                    setCustomSchemas(customSchemas.filter((s) => s !== schema))
                                  }
                                }}
                              />
                              <span className="text-sm">{schema}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </SheetPanel>
              </SheetPopup>
              <TooltipPopup side="top">
                {getContextTooltip()}
              </TooltipPopup>
            </Sheet>
            </Tooltip>

            {/* Right side controls */}
            <div className="flex items-center">
              {/* Model selector */}
              <Menu>
                <MenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 font-normal text-gray-600 hover:text-gray-900"
                    />
                  }
                >
                  <span className="text-xs">
                    {currentProvider
                      ? abbreviateModelName(currentProvider.name, currentProvider.model)
                      : 'Select model'}
                  </span>
                  <ChevronDown className="size-3 opacity-50" />
                </MenuTrigger>
                <MenuPopup align="end">
                  {providers.map((p) => (
                    <MenuItem
                      key={p.id}
                      onClick={() => setSelectedProvider(p.id)}
                    >
                      {p.model}
                    </MenuItem>
                  ))}
                </MenuPopup>
              </Menu>

              {/* Clear conversation button */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearConversation}
                      disabled={messages.length === 0}
                      className="px-2"
                    />
                  }
                >
                  <Eraser className="size-3.5" />
                </TooltipTrigger>
                <TooltipPopup side="top">
                  Clear conversation
                </TooltipPopup>
              </Tooltip>

              {/* Send button */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading || !selectedProvider}
                      className="px-2"
                    />
                  }
                >
                  <Send className="size-3.5" />
                </TooltipTrigger>
                <TooltipPopup side="top">
                  Send message
                </TooltipPopup>
              </Tooltip>
            </div>
        </div>
      </div>

      {/* Messages area - newest first */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {isLoading && (
            <div className="flex gap-1 px-3 py-2">
              <span className="size-2 rounded-full bg-gray-400 animate-bounce" />
              <span className="size-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.1s]" />
              <span className="size-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.2s]" />
            </div>
          )}
          {[...messages].reverse().map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onInsertSQL={onInsertSQL}
              onRunSQL={onRunSQL}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function HighlightedSQL({ sql }: { sql: string }) {
  const tokens = tokenize(sql)

  if (tokens.length === 0) {
    // Fallback to plain text if tokenization fails
    return <code>{sql}</code>
  }

  // Build highlighted segments
  const segments: React.ReactNode[] = []
  let lastIndex = 0

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    // Add any unhighlighted text before this token
    if (lastIndex < token.from) {
      segments.push(sql.slice(lastIndex, token.from))
    }

    // Add the highlighted token
    segments.push(
      <span key={i} className={token.class}>
        {sql.slice(token.from, token.to)}
      </span>
    )

    lastIndex = token.to
  }

  // Add any remaining text after the last token
  if (lastIndex < sql.length) {
    segments.push(sql.slice(lastIndex))
  }

  return <code>{segments}</code>
}

const markdownComponents = {
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className="text-base font-semibold mt-2 mb-1 text-gray-900">{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="text-sm font-semibold mt-2 mb-1 text-gray-900">{children}</h3>,
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-1.5 last:mb-0 leading-relaxed text-gray-700">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc list-inside mb-1.5 space-y-0.5 text-gray-700">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal list-inside mb-1.5 space-y-0.5 text-gray-700">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      const sql = String(children).replace(/\n$/, '')
      return (
        <pre className="bg-white rounded p-1.5 text-xs font-mono overflow-x-auto border border-gray-200 my-1.5">
          <HighlightedSQL sql={sql} />
        </pre>
      )
    }
    return <code className="bg-white rounded px-1 py-0.5 text-xs font-mono text-gray-800 border border-gray-200">{children}</code>
  },
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}

function MessageBubble({
  message,
  onInsertSQL,
  onRunSQL,
}: {
  message: Message
  onInsertSQL: (sql: string) => void
  onRunSQL: (sql: string) => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (message.sql) {
      navigator.clipboard.writeText(message.sql)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end gap-1">
        {message.auto && (
          <span className="text-[10px] text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded-full">Auto</span>
        )}
        <div className="max-w-[85%] rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
          <ReactMarkdown components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {message.auto && (
        <span className="text-[10px] text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded-full">Auto</span>
      )}
      {message.error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">
          {message.error}
        </div>
      )}
      {message.isExplanation ? (
        <div className="max-w-[85%] rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
          <ReactMarkdown components={markdownComponents}>
            {message.content}
          </ReactMarkdown>
        </div>
      ) : (
        <>
          {message.content && <div className="text-sm text-gray-700">{message.content}</div>}
          {message.sql && (
            <div className="relative rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
              <div className="absolute top-2 right-2 flex gap-1 bg-white/90 backdrop-blur-sm rounded border border-gray-200 p-1">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onRunSQL(message.sql!)}
                      />
                    }
                  >
                    <Play className="size-3" />
                  </TooltipTrigger>
                  <TooltipPopup>Run Query</TooltipPopup>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onInsertSQL(message.sql!)}
                      />
                    }
                  >
                    <ArrowLeftToLine className="size-3" />
                  </TooltipTrigger>
                  <TooltipPopup>Insert to Editor</TooltipPopup>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button variant="ghost" size="icon-xs" onClick={handleCopy} />
                    }
                  >
                    {copied ? (
                      <Check className="size-3 text-green-600" />
                    ) : (
                      <Clipboard className="size-3" />
                    )}
                  </TooltipTrigger>
                  <TooltipPopup>{copied ? 'Copied!' : 'Copy'}</TooltipPopup>
                </Tooltip>
              </div>
              <pre className="p-3 pr-24 text-xs overflow-x-auto">
                <HighlightedSQL sql={message.sql} />
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  )
}
