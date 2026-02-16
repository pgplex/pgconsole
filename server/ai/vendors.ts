import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'

export type Vendor = 'openai' | 'anthropic' | 'google'

const DEFAULT_SYSTEM_PROMPT = 'You are a PostgreSQL expert.'
const MAX_ANTHROPIC_HISTORY_MESSAGES = 10  // Limit to prevent unbounded session growth

export interface GenerateResult {
  sql: string
  sessionId: string
}

// Helper: Format error message consistently
function formatErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error'
}

// Helper: Extract text content from Google Interactions API outputs
function extractTextFromOutputs(outputs: any[] | undefined): string {
  const textOutput = outputs?.find((output) => output.type === 'text')
  return textOutput?.text ?? ''
}

export async function generateWithVendor(
  vendor: Vendor,
  apiKey: string,
  model: string,
  systemPrompt: string | null,  // null on subsequent messages
  userPrompt: string,
  sessionId: string | null       // null on first message
): Promise<GenerateResult> {
  switch (vendor) {
    case 'openai': {
      const client = new OpenAI({ apiKey })

      if (!sessionId) {
        // First message: Create conversation
        try {
          const conversation = await client.conversations.create({})
          const response = await client.responses.create({
            conversation: conversation.id,
            input: [
              { role: 'system', content: systemPrompt! },
              { role: 'user', content: userPrompt }
            ],
            model,
            temperature: 0,
          })
          const sql = response.output_text ?? ''
          return { sql, sessionId: conversation.id }
        } catch (err) {
          // Fallback to chat completions if Conversations API not available
          const response = await client.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: systemPrompt! },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0,
          })
          const sql = response.choices[0]?.message?.content ?? ''
          // Generate a pseudo-session ID for stateless mode
          return { sql, sessionId: `stateless-${Date.now()}` }
        }
      } else {
        // Subsequent: Continue conversation
        try {
          const response = await client.responses.create({
            conversation: sessionId,
            input: [{ role: 'user', content: userPrompt }],
            model,
            temperature: 0,
          })
          const sql = response.output_text ?? ''
          return { sql, sessionId }
        } catch (err) {
          // If session invalid/expired, throw to trigger new session
          throw new Error(`Session expired or invalid: ${formatErrorMessage(err)}`)
        }
      }
    }

    case 'anthropic': {
      // Anthropic's Messages API is stateless, so we encode the full conversation
      // history as a base64 JSON session ID to maintain multi-turn context
      const client = new Anthropic({ apiKey })

      // Decode session history (base64 JSON) or start fresh
      interface MessageHistory {
        system: string
        messages: Array<{ role: 'user' | 'assistant'; content: string }>
      }

      let history: MessageHistory
      try {
        const decoded = sessionId
          ? JSON.parse(Buffer.from(sessionId, 'base64').toString('utf-8'))
          : { system: systemPrompt!, messages: [] }

        // Validate structure
        if (
          decoded &&
          typeof decoded.system === 'string' &&
          Array.isArray(decoded.messages) &&
          decoded.messages.every((m: any) =>
            m.role && m.content && ['user', 'assistant'].includes(m.role)
          )
        ) {
          history = decoded
        } else {
          throw new Error('Invalid session structure')
        }
      } catch (err) {
        // Invalid session ID, silently start fresh conversation
        history = {
          system: systemPrompt!,
          messages: []
        }
      }

      // Build message array for API call - limit history to prevent unbounded growth
      const messages = [
        ...history.messages.slice(-MAX_ANTHROPIC_HISTORY_MESSAGES),
        { role: 'user' as const, content: userPrompt }
      ]

      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: history.system,
        messages,
      })

      const content = response.content[0]
      const sql = content.type === 'text' ? content.text : ''

      // Update history and encode as new session ID
      const newHistory: MessageHistory = {
        system: history.system,
        messages: [
          ...messages,
          { role: 'assistant' as const, content: sql }
        ]
      }

      const newSessionId = Buffer.from(JSON.stringify(newHistory)).toString('base64')

      return { sql, sessionId: newSessionId }
    }

    case 'google': {
      // Google's Interactions API provides server-side session management
      const client = new GoogleGenAI({ apiKey })

      if (!sessionId) {
        // First message: Create interaction with system instruction
        const interaction = await client.interactions.create({
          model,
          system_instruction: systemPrompt || DEFAULT_SYSTEM_PROMPT,
          input: userPrompt,
        })

        const sql = extractTextFromOutputs(interaction.outputs)
        return { sql, sessionId: interaction.id }
      } else {
        // Subsequent: Continue conversation with previous_interaction_id
        try {
          const interaction = await client.interactions.create({
            model,
            input: userPrompt,
            previous_interaction_id: sessionId,
          })

          const sql = extractTextFromOutputs(interaction.outputs)
          return { sql, sessionId: interaction.id }
        } catch (err) {
          // If session invalid/expired, throw to trigger new session
          throw new Error(`Session expired or invalid: ${formatErrorMessage(err)}`)
        }
      }
    }

    default:
      throw new Error(`Unknown vendor: ${vendor}`)
  }
}
