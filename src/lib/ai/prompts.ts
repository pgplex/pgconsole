/**
 * Frontend AI prompt templates
 *
 * Mirrored from server/ai/prompts.ts following the same PromptConfig pattern.
 * Keep in sync with server-side documentation.
 */

interface PromptConfig {
  system: string
  user: (params: Record<string, string>) => string
}

/**
 * SYNTAX_CORRECTION: Auto-correction for syntax errors
 *
 * Mirrored from: server/ai/prompts.ts
 * Used in: Chat.tsx auto-validation loop
 * Context: Follow-up message in TEXT_TO_SQL session with sessionId
 */
export const SYNTAX_CORRECTION: PromptConfig = {
  system: '', // Not used - follow-up in existing session

  user: ({ errorMessage }) =>
    `The SQL you generated has a syntax error: ${errorMessage}. Please fix it.`,
}
