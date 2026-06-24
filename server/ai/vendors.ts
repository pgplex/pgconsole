import { generateText, type ModelMessage, type LanguageModel } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

export type Vendor = 'openai' | 'anthropic' | 'google' | 'openai-compatible'

const MAX_HISTORY_MESSAGES = 10  // Cap conversation tail to bound session blob size
const MAX_SESSION_ID_BYTES = 256 * 1024  // Reject oversized untrusted session blobs before decoding
const MAX_OUTPUT_TOKENS = 4096

export interface GenerateResult {
  sql: string
  sessionId: string
}

// Build a Vercel AI SDK language model for the given vendor. All vendors share the
// stateless messages interface; openai-compatible covers any OpenAI-wire provider
// (Groq, OpenRouter, Ollama, vLLM, LiteLLM, ...) via base_url.
function buildModel(
  vendor: Vendor,
  apiKey: string | undefined,  // optional for keyless openai-compatible providers (Ollama, vLLM)
  model: string,
  baseUrl?: string
): LanguageModel {
  switch (vendor) {
    case 'openai':
      return createOpenAI({ apiKey })(model)
    case 'anthropic':
      return createAnthropic({ apiKey })(model)
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(model)
    case 'openai-compatible':
      if (!baseUrl) {
        throw new Error('base_url is required for openai-compatible providers')
      }
      // Use base_url as the provider name so error messages distinguish providers
      return createOpenAICompatible({ name: baseUrl, baseURL: baseUrl, apiKey })(model)
    default:
      throw new Error(`Unknown vendor: ${vendor}`)
  }
}

// Only system/user/assistant string messages are produced here; drop anything else
// in a decoded session so a corrupted or stale session ID yields a clean message
// array rather than malformed input to the SDK.
function isValidMessage(m: unknown): m is ModelMessage {
  if (!m || typeof m !== 'object') return false
  const { role, content } = m as { role?: unknown; content?: unknown }
  return (role === 'system' || role === 'user' || role === 'assistant') && typeof content === 'string'
}

// Keep at most one system message and cap the conversation tail, bounding the blob
// size on both decode (untrusted input) and encode (outgoing).
function trimHistory(messages: ModelMessage[]): ModelMessage[] {
  const system = messages.filter((m) => m.role === 'system').slice(0, 1)
  const rest = messages.filter((m) => m.role !== 'system')
  return [...system, ...rest.slice(-MAX_HISTORY_MESSAGES)]
}

// The conversation lives in the session ID as base64-encoded JSON, so the server
// stays stateless and the client round-trips context across turns.
function decodeHistory(sessionId: string, systemPrompt: string | null): ModelMessage[] {
  if (sessionId && Buffer.byteLength(sessionId, 'utf8') <= MAX_SESSION_ID_BYTES) {
    try {
      const decoded = JSON.parse(Buffer.from(sessionId, 'base64').toString('utf-8'))
      if (Array.isArray(decoded?.messages)) {
        const valid = decoded.messages.filter(isValidMessage)
        if (valid.length > 0) return trimHistory(valid)
      }
    } catch {
      // Invalid session ID — silently start fresh
    }
  }
  return systemPrompt ? [{ role: 'system', content: systemPrompt }] : []
}

function encodeHistory(messages: ModelMessage[]): string {
  return Buffer.from(JSON.stringify({ messages: trimHistory(messages) })).toString('base64')
}

export async function generateWithVendor(
  vendor: Vendor,
  apiKey: string | undefined,
  model: string,
  systemPrompt: string | null,  // null on subsequent messages (system already in history)
  userPrompt: string,
  sessionId: string,            // empty on first message
  baseUrl?: string
): Promise<GenerateResult> {
  const languageModel = buildModel(vendor, apiKey, model, baseUrl)

  const messages = decodeHistory(sessionId, systemPrompt)
  messages.push({ role: 'user', content: userPrompt })

  const { text } = await generateText({
    model: languageModel,
    messages,
    temperature: 0,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  })

  messages.push({ role: 'assistant', content: text })
  return { sql: text, sessionId: encodeHistory(messages) }
}
