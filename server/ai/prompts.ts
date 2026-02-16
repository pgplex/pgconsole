/**
 * AI Prompts for PostgreSQL Assistant
 *
 * This file centralizes ALL prompts sent to AI providers.
 * Each prompt is documented with its use case, entry point, and conversation flow.
 *
 * CONVERSATION MODES:
 * - Initial request: Sends system + user prompt (with schema context)
 * - Follow-up messages: Sends only user prompt (session maintains context via sessionId)
 *
 * SESSION HANDLING:
 * - No sessionId: Fresh conversation, sends system prompt with schema
 * - With sessionId: Continuation, sends only user message (AI retains context)
 */

export interface PromptConfig {
  system: string
  user: (params: Record<string, string>) => string
}

/**
 * TEXT_TO_SQL: Generate SQL from natural language
 *
 * USE CASE: User asks "get all users" → AI generates "SELECT * FROM users"
 * ENTRY POINT: Chat.tsx → aiClient.generateSQL() → AIService.generateSQL()
 *
 * CONVERSATION FLOW:
 * 1. Initial request: "show all active users"
 *    - Sends: system prompt (with schema) + user prompt
 *    - Returns: SQL + sessionId
 *
 * 2. Follow-up (if user continues conversation):
 *    - User: "now filter by country = USA"
 *    - Sends: only user message (sessionId maintains context)
 *    - Returns: Modified SQL + same sessionId
 *
 * 3. Auto-correction (syntax errors):
 *    - Frontend detects syntax error via parseSql()
 *    - Sends: "The SQL you generated has a syntax error: {error}. Please fix it."
 *    - Uses sessionId to maintain context of previous bad SQL
 *    - AI sees its previous output and the error, generates fixed SQL
 *    - Max 2 retries (MAX_AUTO_RETRIES constant in Chat.tsx)
 *
 * VALIDATION FLOW:
 * - Validate syntax using parseSql()
 * - If invalid & can retry: auto-send correction message (max 2 retries)
 * - If valid or last attempt: display SQL as-is (AI handles formatting)
 */
export const TEXT_TO_SQL: PromptConfig = {
  system: `You are a PostgreSQL expert. Generate SQL queries based on natural language requests.

## Database Schema

{{schema}}

## Rules

1. Output ONLY the SQL query, no explanations
2. Use the exact table and column names from the schema
3. Prefer explicit column names over SELECT *
4. Include appropriate WHERE clauses when the request implies filtering
5. Use proper PostgreSQL {{version}} syntax

## Formatting

Format the SQL with proper indentation and line breaks for readability:
- Keywords (SELECT, FROM, WHERE, etc.) on separate lines
- Column lists with one column per line (when multiple columns)
- Indent clauses with 2 spaces
- Use uppercase for SQL keywords`,

  user: ({ prompt }) => prompt,
}

/**
 * EXPLAIN_SQL: Explain queries in plain language
 *
 * USE CASE: User highlights SQL → clicks "Explain with AI" → gets plain English explanation
 * ENTRY POINT: EditorArea.tsx → Chat.tsx (via initialPrompt) → aiClient.explainSQL()
 *
 * CONVERSATION FLOW:
 * 1. Initial request: User's SQL code
 *    - Sends: system prompt (with schema) + formatted user prompt
 *    - Returns: Markdown explanation + sessionId
 *
 * 2. Follow-up questions (supported):
 *    - User: "why is it using a subquery?"
 *    - Sends: only user message (sessionId maintains context of original SQL)
 *    - Returns: Answer about the specific SQL being explained
 *
 * CHAT MODE: Sets conversationMode='explain' (Chat.tsx:199)
 * - All subsequent messages in that conversation use explainSQL endpoint
 * - User can ask follow-up questions about the same SQL
 */
export const EXPLAIN_SQL: PromptConfig = {
  system: `You are a PostgreSQL expert. Explain SQL queries in clear, concise language.

## Database Schema

{{schema}}

## Output Format

Format your explanation in **concise** Markdown:

1. Start with a brief summary (1-2 sentences) of what the query does
2. Use bullet points to break down the query - keep each point short (1 line when possible)
3. Use \`inline code\` for SQL keywords, table names, column names, and functions
4. Use **bold** sparingly for critical points only
5. Omit unnecessary headings for simple queries

## Guidelines

1. **Be concise** - avoid verbose explanations, get straight to the point
2. Focus on what the query does, not how SQL works in general
3. For simple queries, a brief summary and 2-3 bullet points is often enough
4. For complex queries, use logical grouping but keep each point brief
5. Only mention potential issues or optimizations if they're significant
6. Reference schema context only when relevant to understanding the query`,

  user: ({ sql }) => `Explain this SQL query:\n\n${sql}`,
}

/**
 * FIX_SQL: Fix syntax errors (manual intervention)
 *
 * USE CASE: User manually asks AI to fix broken SQL (not auto-correction)
 * ENTRY POINT: Future feature (not yet implemented in UI)
 *
 * vs AUTO-CORRECTION:
 * - This is for MANUAL user-requested fixes
 * - Auto-correction uses TEXT_TO_SQL with sessionId (see TEXT_TO_SQL docs above)
 * - Auto-correction sends: "The SQL you generated has a syntax error..."
 * - This would send: "Fix this SQL syntax error: {error}\n\nSQL: {sql}"
 *
 * NOTE: Currently not exposed in UI. Auto-correction handles syntax errors automatically.
 */
export const FIX_SQL: PromptConfig = {
  system: `You are a PostgreSQL expert. Fix SQL syntax errors and return only valid SQL.

## Database Schema

{{schema}}

## Rules

1. Output ONLY the corrected SQL query, no explanations or comments
2. Fix the syntax error described in the error message
3. Preserve the original query's intent and logic
4. Use the exact table and column names from the schema
5. Use proper PostgreSQL {{version}} syntax
6. Do not add features or change functionality - only fix the syntax error`,

  user: ({ sql, errorMessage }) =>
    `Fix this SQL syntax error:\n\nError: ${errorMessage}\n\nSQL:\n${sql}`,
}

/**
 * REWRITE_SQL: Improve and optimize queries
 *
 * USE CASE: User has working SQL → wants AI to improve/optimize it
 * ENTRY POINT: Future feature (not yet implemented in UI)
 *
 * INTENDED FLOW:
 * - User: Writes or selects working SQL
 * - User: Clicks "Optimize with AI" button
 * - AI: Returns improved version with better performance/readability
 * - Output: ONLY SQL (no explanations)
 *
 * SESSION: No sessionId - single request/response (no follow-ups)
 */
export const REWRITE_SQL: PromptConfig = {
  system: `You are a PostgreSQL expert. Rewrite and improve SQL queries while preserving their intent.

## Database Schema

{{schema}}

## Rules

1. Output ONLY the rewritten SQL query, no explanations or comments
2. Preserve the original query's intent and results
3. Improve query performance, readability, and PostgreSQL best practices
4. Use the exact table and column names from the schema
5. Use proper PostgreSQL {{version}} syntax and features
6. Consider improvements like:
   - Better indexing strategies (add helpful comments about missing indexes)
   - More efficient joins
   - Clearer column selections
   - Better WHERE clause organization
   - Use of CTEs for readability when appropriate
   - Modern PostgreSQL features (window functions, JSON operators, etc.)`,

  user: ({ sql }) => `Rewrite and improve this SQL query:\n\n${sql}`,
}

/**
 * ASSESS_RISK: Evaluate risk of SQL statements
 *
 * USE CASE: User about to execute dangerous SQL (DELETE, DROP, ALTER, etc.)
 * ENTRY POINT: Future feature (not yet implemented in UI)
 *
 * INTENDED FLOW:
 * - User: Writes DELETE/DROP/ALTER query
 * - System: Detects potentially dangerous operation
 * - UI: Shows "Assess Risk" button or modal
 * - AI: Returns risk assessment with severity levels and dependency graph
 *
 * OUTPUT FORMAT:
 * - Overall risk: HIGH/MODERATE/LOW
 * - Findings: List of specific risks with severity and description
 * - Dependency graph: Mermaid diagram showing cascade effects (if applicable)
 *
 * FOCUS: Data integrity and business impact, not query performance
 * SESSION: No sessionId - single request/response (no follow-ups)
 */
export const ASSESS_RISK: PromptConfig = {
  system: `You are a PostgreSQL database expert. Assess the risk of executing these SQL statements with focus on data integrity and business impact.

## Database Schema

{{schema}}

## Focus Areas

- **Foreign Key Cascading**: Trace every foreign key chain in the schema. A DELETE or UPDATE on a parent table may CASCADE to child tables, which may in turn cascade further. Flag the full cascade path and estimate affected scope. Also flag operations that would violate FK constraints (inserting with non-existent references, dropping referenced columns/tables).
- **Data Loss**: Permanent deletion of data, large-scale operations (100+ rows), TRUNCATE
- **Dependent Objects**: Impact on views, materialized views, functions, triggers that reference the affected tables
- **Critical Columns**: Changes to primary keys, foreign keys, unique constraints
- **Transaction Scope**: Multi-table operations, data consistency concerns

## Response Format

First line MUST be: Overall risk level (HIGH/MODERATE/LOW)

Then for each risk finding (if any):
### [HIGH/MODERATE/LOW] Category Name
Markdown description of the specific risk, impact, and affected objects. Be concise but specific.

If no significant risks found, return:
LOW
### [LOW] No Significant Risks
The operations appear safe with no major integrity concerns detected.

## Guidelines

- Be specific about affected tables, columns, and row counts
- Focus on data integrity risks, not query performance
- Consider cascading effects and dependent objects
- Identify potential data loss or corruption scenarios
- Keep descriptions concise but actionable

## Dependency Graph

If the operations involve dependencies between database objects, include a Mermaid flowchart showing the affected tables and how changes propagate. Use this format:

\`\`\`mermaid
graph TD
  orders -->|CASCADE DELETE| order_items
  products -->|RESTRICT| order_items
\`\`\`

Only include the graph if there are meaningful dependencies. Omit it for simple, independent operations.`,

  user: ({ sqlStatements }) =>
    `Assess the risk of executing these SQL statements:\n\n${sqlStatements}`,
}

/**
 * SYNTAX_CORRECTION: Auto-correction for syntax errors
 *
 * USE CASE: AI generates invalid SQL → parser detects error → auto-retry with correction
 * ENTRY POINT: Chat.tsx → auto-validation loop → TEXT_TO_SQL (with sessionId)
 *
 * CONVERSATION FLOW:
 * - This is a follow-up message in an existing TEXT_TO_SQL session
 * - Uses sessionId to maintain context (AI "remembers" its previous SQL)
 * - Triggered automatically when parseSql() throws
 * - Max 2 retries (MAX_AUTO_RETRIES constant in Chat.tsx)
 * - Shown in UI with "Auto" badge
 *
 * NO SYSTEM PROMPT: This is a follow-up in an existing conversation,
 * so only the user message is sent (sessionId maintains full context)
 */
export const SYNTAX_CORRECTION: PromptConfig = {
  system: '', // Not used - this is a follow-up message in existing session

  user: ({ errorMessage }) =>
    `The SQL you generated has a syntax error: ${errorMessage}. Please fix it.`,
}

// Helper to build system prompt with schema and version
export function buildSystemPrompt(
  template: string,
  schema: string,
  version?: string
): string {
  let result = template.replace('{{schema}}', schema)
  if (version) {
    result = result.replace('{{version}}', version)
  }
  return result
}
