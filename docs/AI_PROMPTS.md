# AI Prompts Architecture

This document maps all AI prompts used in pgconsole, their entry points, and conversation flows.

## Prompt Locations

- **Server prompts**: `server/ai/prompts.ts` (backend AI service)
- **Frontend prompts**: `src/lib/ai/prompts.ts` (UI-constructed messages)

## Active Prompts (Currently in Use)

### 1. TEXT_TO_SQL
**Purpose**: Generate SQL from natural language  
**Entry Point**: Chat.tsx → `aiClient.generateSQL()` → `AIService.generateSQL()`  
**Status**: ✅ Active

**Flow:**
```
User: "get all users"
  ↓ (initial request)
System: [schema context] + "Generate SQL from: get all users"
  ↓
AI: "SELECT * FROM users"
  ↓ (if syntax error detected by parseSql())
System: "The SQL you generated has a syntax error: {error}. Please fix it."
  ↓ (uses sessionId to maintain context)
AI: "SELECT * FROM users" (corrected)
```

**Auto-Correction:**
- Max 2 retries (MAX_AUTO_RETRIES constant)
- Validates syntax using parseSql()
- Uses `SYNTAX_CORRECTION.user()` from `src/lib/ai/prompts.ts`
- AI handles formatting (no client-side formatting applied)

### 2. EXPLAIN_SQL
**Purpose**: Explain queries in plain language  
**Entry Point**: EditorArea.tsx → Chat (initialPrompt) → `aiClient.explainSQL()`  
**Status**: ✅ Active

**Flow:**
```
User: [selects SQL] → clicks "Explain with AI"
  ↓ (initial request)
System: [schema context] + "Explain this SQL: {sql}"
  ↓
AI: [Markdown explanation]
  ↓ (follow-up question)
User: "why is it using a subquery?"
  ↓ (sessionId maintains context)
AI: [Answer about specific SQL]
```

**Conversation Mode:**
- Sets `conversationMode='explain'` in Chat.tsx
- All subsequent messages use explainSQL endpoint
- Supports natural follow-up questions

## Planned Prompts (Not Yet in UI)

### 3. FIX_SQL
**Purpose**: Manual SQL syntax fixes  
**Status**: ⏳ Not implemented in UI  
**vs Auto-Correction**: This is for MANUAL user requests, not automatic retries

### 4. REWRITE_SQL
**Purpose**: Optimize and improve working SQL  
**Status**: ⏳ Not implemented in UI  
**Intended Entry**: Future "Optimize with AI" button

### 5. ASSESS_RISK
**Purpose**: Evaluate risk of dangerous operations  
**Status**: ⏳ Not implemented in UI  
**Intended Entry**: Pre-execution warning for DELETE/DROP/ALTER

## Session Handling

### Initial Request
- Sends: **system prompt + user prompt** (includes schema context)
- Returns: Response + `sessionId`

### Follow-up Messages
- Sends: **only user message** (no system prompt)
- Context: Maintained by AI provider via `sessionId`
- Used for: Conversation continuity, auto-correction retries

## Optimization Opportunities

### TEXT_TO_SQL Auto-Correction
Current: `"The SQL you generated has a syntax error: {error}. Please fix it."`

Potential improvements:
- Add line number context
- Include problematic SQL clause
- Suggest likely fix direction
- Tune phrasing based on fix success rate

### Schema Context
Current: Sends full schema on every initial request

Potential improvements:
- Cache schema embeddings per connection
- Send only relevant tables based on user query
- Incremental schema updates via sessionId

## Testing Strategy

When modifying prompts:
1. Test initial request (cold start, no sessionId)
2. Test follow-up messages (with sessionId)
3. Test auto-correction flow (syntax errors)
4. Verify schema context is correctly injected
5. Check response format matches expectations

## Related Files

- `server/ai/prompts.ts` - All prompt templates with documentation
- `src/lib/ai/prompts.ts` - Frontend prompt builders
- `src/components/sql-editor/Chat.tsx` - Main conversation UI
- `server/services/ai-service.ts` - Backend AI handlers
- `server/ai/vendors.ts` - AI provider implementations
