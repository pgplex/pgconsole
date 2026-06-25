import { parse } from 'smol-toml'
import { readFileSync } from 'fs'
import type { Vendor } from '../ai/vendors'

export interface LabelConfig {
  id: string
  name: string
  color: string
}

export interface ConnectionConfig {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
  password?: string
  ssl_mode?: string
  ssl_ca?: string
  ssl_cert?: string
  ssl_key?: string
  color?: string
  labels?: string[]
  lock_timeout?: string
  statement_timeout?: string
  lazy?: boolean
}

export interface UserConfig {
  email: string
  password?: string
  owner: boolean
}

export interface AuthProviderConfig {
  type: 'google' | 'keycloak' | 'okta'
  client_id: string
  client_secret: string
  issuer_url?: string  // required for keycloak and okta
}

export interface AuthConfig {
  jwt_secret: string
  signin_expiry?: string // e.g. "7d", "24h", "2w" (default: "7d")
  providers: AuthProviderConfig[]
}

export interface AIProviderConfig {
  id: string
  name?: string
  vendor: Vendor
  model: string
  api_key?: string  // Optional for openai-compatible (keyless local providers); required otherwise
  base_url?: string  // Required for openai-compatible; ignored otherwise
}

export interface AIConfig {
  providers: AIProviderConfig[]
}

// A non-human principal that authenticates to the MCP server with a bearer token.
// - Pure agent (no on_behalf_of): a standalone service account; authorized by
//   [[iam]] rules whose members include `agent:<id>`.
// - Delegated agent (on_behalf_of set): acts for a user, inheriting that user's
//   permissions narrowed by the optional `permissions`/`connections` caps.
export interface AgentConfig {
  id: string
  name: string
  token: string
  onBehalfOf?: string        // user email; presence makes the agent delegated
  permissions?: Permission[] // cap, intersected with the user's grant (delegated only)
  connections?: string[]     // cap, connection IDs the agent may touch (delegated only)
}

export interface BannerConfig {
  text: string
  link?: string
  color?: string
}

export interface BrandingConfig {
  logo?: string
  logo_link?: string
}

export interface GroupConfig {
  id: string
  name: string
  members: string[]
}

export type Permission = 'read' | 'write' | 'ddl' | 'admin' | 'explain' | 'execute' | 'export'

export interface IAMRule {
  connection: string  // connection ID or "*" for wildcard
  permissions: Permission[]
  members: string[]   // "user:xxx", "group:xxx", or "*"
}

interface Config {
  external_url?: string
  banner?: BannerConfig
  branding?: BrandingConfig
  users: UserConfig[]
  groups: GroupConfig[]
  labels: LabelConfig[]
  connections: ConnectionConfig[]
  auth?: AuthConfig
  ai?: AIConfig
  agents: AgentConfig[]
  iam: IAMRule[]
}

const validSslModes = ['disable', 'prefer', 'require', 'verify-full']
const VALID_PERMISSIONS: Permission[] = ['read', 'write', 'ddl', 'admin', 'explain', 'execute', 'export']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Reserved [[iam]] member prefixes. Group members are bare emails, so any of these is a mistake.
const IAM_MEMBER_PREFIX_RE = /^(user|group|agent):/i

// Validate an array of permission strings, expanding '*' to the full set. `label` prefixes errors.
function parsePermissionList(raw: unknown, label: string): Permission[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`${label} must be a non-empty array`)
  }
  const permissions: Permission[] = []
  for (const perm of raw) {
    if (perm === '*') {
      permissions.push(...VALID_PERMISSIONS)
    } else if (typeof perm !== 'string' || !VALID_PERMISSIONS.includes(perm as Permission)) {
      throw new Error(`${label} has invalid permission: ${perm}. Must be one of: ${VALID_PERMISSIONS.join(', ')}, *`)
    } else {
      permissions.push(perm as Permission)
    }
  }
  return permissions
}

const DEFAULT_CONFIG: Config = { users: [], groups: [], labels: [], connections: [], auth: undefined, ai: undefined, agents: [], banner: undefined, branding: undefined, iam: [] }

let loadedConfig: Config = { ...DEFAULT_CONFIG }
let demoMode = false

function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color)
}

// Validate that `value` is a parseable http(s) URL. `field` prefixes the error message.
function validateHttpUrl(value: string, field: string): void {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${field} is not a valid URL: ${value}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${field} must use http or https: ${value}`)
  }
}

export async function loadConfig(configPath: string): Promise<void> {
  let content: string
  try {
    content = readFileSync(configPath, 'utf-8')
  } catch {
    throw new Error(`Config file not found: ${configPath}\nSee https://docs.pgconsole.com/configuration/config`)
  }
  return loadConfigFromString(content)
}

export async function loadConfigFromString(content: string): Promise<void> {
  demoMode = false

  const parsed = parse(content) as { general?: Record<string, unknown>, branding?: Record<string, unknown>, users?: unknown[], groups?: unknown[], labels?: unknown[], connections?: unknown[], auth?: Record<string, unknown>, ai?: Record<string, unknown>, agents?: unknown[] }

  // Parse [general] section
  let external_url: string | undefined = undefined
  let banner: BannerConfig | undefined = undefined
  if (parsed.general) {
    const g = parsed.general
    if (g.external_url !== undefined) {
      if (typeof g.external_url !== 'string') {
        throw new Error('general.external_url must be a string')
      }
      // Remove trailing slash for consistency
      external_url = g.external_url.replace(/\/+$/, '')
      // Basic URL validation
      try {
        new URL(external_url)
      } catch {
        throw new Error(`general.external_url is not a valid URL: ${external_url}`)
      }
    }

    // Parse [general.banner] section
    const rawBanner = g.banner as Record<string, unknown> | undefined
    if (rawBanner) {
      const text = rawBanner.text
      if (text && typeof text === 'string' && text.trim()) {
        const bannerConfig: BannerConfig = { text: text.trim() }

        // Validate and set link if provided
        if (rawBanner.link !== undefined) {
          if (typeof rawBanner.link !== 'string') {
            throw new Error('general.banner.link must be a string')
          }
          try {
            new URL(rawBanner.link)
          } catch {
            throw new Error(`general.banner.link is not a valid URL: ${rawBanner.link}`)
          }
          bannerConfig.link = rawBanner.link
        }

        // Validate and set color if provided
        if (rawBanner.color !== undefined) {
          if (typeof rawBanner.color !== 'string') {
            throw new Error('general.banner.color must be a string')
          }
          if (!isValidHexColor(rawBanner.color)) {
            throw new Error(`general.banner.color is not a valid hex color: ${rawBanner.color}`)
          }
          bannerConfig.color = rawBanner.color
        }

        banner = bannerConfig
      }
    }
  }

  // Parse [branding] section
  let branding: BrandingConfig | undefined = undefined
  if (parsed.branding) {
    const b = parsed.branding
    const brandingConfig: BrandingConfig = {}

    if (b.logo !== undefined) {
      if (typeof b.logo !== 'string') {
        throw new Error('branding.logo must be a string')
      }
      try {
        new URL(b.logo)
      } catch {
        throw new Error(`branding.logo is not a valid URL: ${b.logo}`)
      }
      brandingConfig.logo = b.logo
    }

    if (b.logo_link !== undefined) {
      if (typeof b.logo_link !== 'string') {
        throw new Error('branding.logo_link must be a string')
      }
      const logoLink = b.logo_link.trim()
      if (logoLink.startsWith('/')) {
        brandingConfig.logo_link = logoLink
      } else {
        validateHttpUrl(logoLink, 'branding.logo_link')
        brandingConfig.logo_link = logoLink
      }
    }

    if (brandingConfig.logo) {
      branding = brandingConfig
    }
  }

  // Parse and validate labels
  const labels: LabelConfig[] = []
  const seenLabelIds = new Set<string>()

  for (const label of parsed.labels || []) {
    const l = label as Record<string, unknown>

    // Validate required fields
    if (!l.id || typeof l.id !== 'string' || !l.id.trim()) {
      throw new Error('Label missing required field: id (must be non-empty string)')
    }
    if (!l.name || typeof l.name !== 'string' || !l.name.trim()) {
      throw new Error(`Label ${l.id} missing required field: name (must be non-empty string)`)
    }
    if (!l.color || typeof l.color !== 'string') {
      throw new Error(`Label ${l.id} missing required field: color`)
    }

    const labelId = l.id.trim()
    const labelName = l.name.trim()
    const labelColor = l.color.trim()

    // Check unique ID
    if (seenLabelIds.has(labelId)) {
      throw new Error(`Duplicate label ID: ${labelId}`)
    }
    seenLabelIds.add(labelId)

    // Validate color format
    if (!isValidHexColor(labelColor)) {
      throw new Error(`Label ${labelId} has invalid color: ${labelColor} (must be hex format like #fff or #ffffff)`)
    }

    labels.push({
      id: labelId,
      name: labelName,
      color: labelColor,
    })
  }

  // Parse and validate groups
  const groups: GroupConfig[] = []
  const seenGroupIds = new Set<string>()

  for (const group of parsed.groups || []) {
    const g = group as Record<string, unknown>

    // Validate required fields
    if (!g.id || typeof g.id !== 'string' || !g.id.trim()) {
      throw new Error('Group missing required field: id (must be non-empty string)')
    }
    if (!g.name || typeof g.name !== 'string' || !g.name.trim()) {
      throw new Error(`Group ${g.id} missing required field: name (must be non-empty string)`)
    }
    if (!Array.isArray(g.members)) {
      throw new Error(`Group ${g.id} missing required field: members (must be an array)`)
    }

    const groupId = g.id.trim()
    const groupName = g.name.trim()

    // Check unique ID
    if (seenGroupIds.has(groupId)) {
      throw new Error(`Duplicate group ID: ${groupId}`)
    }
    seenGroupIds.add(groupId)

    // Validate members are strings
    const members: string[] = []
    for (const member of g.members) {
      if (typeof member !== 'string' || !member.trim()) {
        throw new Error(`Group ${groupId} has invalid member: must be non-empty string`)
      }
      const trimmed = member.trim()
      // Group members are bare user emails. A `user:`/`group:`/`agent:` prefix is
      // [[iam]] member syntax that never matches here — reject it rather than fail silently.
      // Agents in particular are an intentionally distinct principal class: grant them
      // directly with an [[iam]] rule using member "agent:<id>".
      const prefixMatch = IAM_MEMBER_PREFIX_RE.exec(trimmed)
      if (prefixMatch) {
        throw new Error(`Group ${groupId} member "${trimmed}": group members are bare user emails; the "${prefixMatch[1]}:" prefix is [[iam]] member syntax`)
      }
      members.push(trimmed)
    }

    groups.push({
      id: groupId,
      name: groupName,
      members,
    })
  }

  // Parse and validate users
  const users: UserConfig[] = []
  const seenEmails = new Set<string>()

  for (const entry of parsed.users || []) {
    const u = entry as Record<string, unknown>

    if (!u.email || typeof u.email !== 'string' || !u.email.trim()) {
      throw new Error('User entry missing required field: email (must be non-empty string)')
    }

    const email = u.email.trim()
    if (!EMAIL_RE.test(email)) {
      throw new Error(`User entry has invalid email: ${email}`)
    }
    if (seenEmails.has(email)) {
      throw new Error(`Duplicate user email: ${email}`)
    }
    seenEmails.add(email)

    users.push({
      email,
      password: typeof u.password === 'string' ? u.password : undefined,
      owner: u.owner === true,
    })
  }

  // Ensure at least one owner exists
  const hasExplicitOwner = users.some(u => u.owner)
  if (!hasExplicitOwner && users.length > 0) {
    users[0].owner = true
  }

  // Parse and validate connections
  const connections: ConnectionConfig[] = []
  const seenIds = new Set<string>()

  for (const conn of parsed.connections || []) {
    const c = conn as Record<string, unknown>

    // Validate required fields
    if (!c.id || typeof c.id !== 'string') {
      throw new Error('Connection missing required field: id')
    }
    if (!c.name || typeof c.name !== 'string') {
      throw new Error(`Connection ${c.id} missing required field: name`)
    }
    if (!c.host || typeof c.host !== 'string') {
      throw new Error(`Connection ${c.id} missing required field: host`)
    }
    if (!c.database || typeof c.database !== 'string') {
      throw new Error(`Connection ${c.id} missing required field: database`)
    }
    if (!c.username || typeof c.username !== 'string') {
      throw new Error(`Connection ${c.id} missing required field: username`)
    }

    // Check unique ID
    if (seenIds.has(c.id)) {
      throw new Error(`Duplicate connection id: ${c.id}`)
    }
    seenIds.add(c.id)

    // Validate ssl_mode if provided
    const sslMode = (c.ssl_mode as string) || 'prefer'
    if (!validSslModes.includes(sslMode)) {
      throw new Error(`Connection ${c.id} has invalid ssl_mode: ${sslMode}`)
    }

    // Validate color if provided
    let color: string | undefined = undefined
    if (c.color !== undefined) {
      if (typeof c.color !== 'string' || !isValidHexColor(c.color.trim())) {
        throw new Error(`Connection ${c.id} has invalid color: ${c.color} (must be hex format like #fff or #ffffff)`)
      }
      color = c.color.trim()
    }

    // Validate labels if provided
    const connectionLabels: string[] = []
    if (c.labels) {
      if (!Array.isArray(c.labels)) {
        throw new Error(`Connection ${c.id} has invalid labels field: must be an array`)
      }
      for (const labelId of c.labels) {
        if (typeof labelId !== 'string') {
          throw new Error(`Connection ${c.id} has invalid label ID: must be string`)
        }
        if (!seenLabelIds.has(labelId)) {
          const availableLabels = Array.from(seenLabelIds).join(', ')
          throw new Error(
            `Connection ${c.id} references unknown label '${labelId}'. Available labels: ${availableLabels || '(none)'}`
          )
        }
        connectionLabels.push(labelId)
      }
    }

    connections.push({
      id: c.id,
      name: c.name,
      host: c.host,
      port: typeof c.port === 'number' ? c.port : 5432,
      database: c.database,
      username: c.username,
      password: typeof c.password === 'string' ? c.password : undefined,
      ssl_mode: sslMode,
      ssl_ca: typeof c.ssl_ca === 'string' ? c.ssl_ca : undefined,
      ssl_cert: typeof c.ssl_cert === 'string' ? c.ssl_cert : undefined,
      ssl_key: typeof c.ssl_key === 'string' ? c.ssl_key : undefined,
      color,
      labels: connectionLabels.length > 0 ? connectionLabels : undefined,
      lock_timeout: typeof c.lock_timeout === 'string' ? c.lock_timeout : undefined,
      statement_timeout: typeof c.statement_timeout === 'string' ? c.statement_timeout : undefined,
      lazy: c.lazy === true,
    })
  }

  // Parse and validate auth config
  let auth: AuthConfig | undefined = undefined
  if (parsed.auth) {
    const a = parsed.auth

    // Validate jwt_secret
    if (!a.jwt_secret || typeof a.jwt_secret !== 'string') {
      throw new Error('Auth config missing required field: jwt_secret')
    }
    if (a.jwt_secret.length < 32) {
      throw new Error('Auth jwt_secret must be at least 32 characters')
    }

    // Parse [[auth.providers]] array
    const providers: AuthProviderConfig[] = []
    const rawProviders = a.providers as unknown[] | undefined
    const validProviderTypes = ['google', 'keycloak', 'okta']
    if (rawProviders && Array.isArray(rawProviders)) {
      for (const entry of rawProviders) {
        const raw = entry as Record<string, unknown>

        if (!raw.type || typeof raw.type !== 'string') {
          throw new Error('Auth provider missing required field: type')
        }
        if (!validProviderTypes.includes(raw.type)) {
          throw new Error(`Auth provider has invalid type: ${raw.type}. Must be one of: ${validProviderTypes.join(', ')}`)
        }
        if (!raw.client_id || typeof raw.client_id !== 'string') {
          throw new Error(`${raw.type} provider missing required field: client_id`)
        }
        if (!raw.client_secret || typeof raw.client_secret !== 'string') {
          throw new Error(`${raw.type} provider missing required field: client_secret`)
        }

        // issuer_url required for keycloak and okta
        if ((raw.type === 'keycloak' || raw.type === 'okta') && (!raw.issuer_url || typeof raw.issuer_url !== 'string')) {
          throw new Error(`${raw.type} provider missing required field: issuer_url`)
        }

        providers.push({
          type: raw.type as AuthProviderConfig['type'],
          client_id: raw.client_id,
          client_secret: raw.client_secret,
          issuer_url: typeof raw.issuer_url === 'string' ? raw.issuer_url.replace(/\/+$/, '') : undefined,
        })
      }
    }

    // Validate external_url is set when OAuth providers are enabled
    const hasOAuthProvider = providers.length > 0
    if (hasOAuthProvider && !external_url) {
      throw new Error('[general] external_url is required when OAuth providers are enabled')
    }

    // Validate at least one [[users]] entry exists when auth is enabled
    if (users.length === 0) {
      throw new Error('[auth] section requires at least one [[users]] entry')
    }

    auth = {
      jwt_secret: a.jwt_secret,
      signin_expiry: typeof a.signin_expiry === 'string' ? a.signin_expiry : undefined,
      providers,
    }
  }

  // Parse and validate AI config
  let ai: AIConfig | undefined = undefined
  const rawAI = parsed.ai as { providers?: unknown[] } | undefined
  if (rawAI?.providers && Array.isArray(rawAI.providers)) {
    const providers: AIProviderConfig[] = []
    const seenProviderIds = new Set<string>()
    const validVendors: Vendor[] = ['openai', 'anthropic', 'google', 'openai-compatible']

    for (const provider of rawAI.providers) {
      const p = provider as Record<string, unknown>

      if (!p.id || typeof p.id !== 'string' || !p.id.trim()) {
        throw new Error('AI provider missing required field: id')
      }
      if (!p.vendor || typeof p.vendor !== 'string') {
        throw new Error(`AI provider ${p.id} missing required field: vendor`)
      }
      if (!validVendors.includes(p.vendor as Vendor)) {
        throw new Error(`AI provider ${p.id} has invalid vendor: ${p.vendor}. Must be one of: ${validVendors.join(', ')}`)
      }
      if (!p.model || typeof p.model !== 'string') {
        throw new Error(`AI provider ${p.id} missing required field: model`)
      }
      // api_key is required for hosted vendors but optional for openai-compatible, since
      // local providers (Ollama, vLLM) run without authentication
      if (p.api_key !== undefined && typeof p.api_key !== 'string') {
        throw new Error(`AI provider ${p.id} field api_key must be a string`)
      }
      const apiKey = typeof p.api_key === 'string' ? p.api_key.trim() : undefined
      if (p.vendor !== 'openai-compatible' && !apiKey) {
        throw new Error(`AI provider ${p.id} missing required field: api_key`)
      }

      // base_url is required for openai-compatible providers and must be a valid http(s) URL
      let baseUrl: string | undefined = undefined
      if (p.vendor === 'openai-compatible') {
        const trimmedBaseUrl = typeof p.base_url === 'string' ? p.base_url.trim() : ''
        if (!trimmedBaseUrl) {
          throw new Error(`AI provider ${p.id} with vendor openai-compatible requires field: base_url`)
        }
        validateHttpUrl(trimmedBaseUrl, `AI provider ${p.id} base_url`)
        baseUrl = trimmedBaseUrl
      }

      const providerId = p.id.trim()
      if (seenProviderIds.has(providerId)) {
        throw new Error(`Duplicate AI provider ID: ${providerId}`)
      }
      seenProviderIds.add(providerId)

      providers.push({
        id: providerId,
        name: typeof p.name === 'string' ? p.name.trim() : providerId,
        vendor: p.vendor as Vendor,
        model: p.model.trim(),
        api_key: apiKey || undefined,
        base_url: baseUrl,
      })
    }

    if (providers.length > 0) {
      ai = { providers }
    }
  }

  // Parse and validate agents (non-human MCP principals)
  const agents: AgentConfig[] = []
  const seenAgentIds = new Set<string>()
  const seenAgentTokens = new Set<string>()
  const rawAgents = (parsed as { agents?: unknown[] }).agents || []

  for (let i = 0; i < rawAgents.length; i++) {
    const a = rawAgents[i] as Record<string, unknown>
    const label = (typeof a.id === 'string' && a.id.trim()) || `#${i + 1}`

    if (!a.id || typeof a.id !== 'string' || !a.id.trim()) {
      throw new Error(`Agent ${label} missing required field: id`)
    }
    const id = a.id.trim()
    if (seenAgentIds.has(id)) {
      throw new Error(`Duplicate agent id: ${id}`)
    }
    seenAgentIds.add(id)

    if (!a.token || typeof a.token !== 'string' || !a.token.trim()) {
      throw new Error(`Agent ${id} missing required field: token`)
    }
    const token = a.token.trim()
    if (seenAgentTokens.has(token)) {
      throw new Error(`Duplicate agent token (agent ${id})`)
    }
    seenAgentTokens.add(token)

    const name = typeof a.name === 'string' && a.name.trim() ? a.name.trim() : id

    // on_behalf_of turns the agent into a delegated principal bounded by that user.
    let onBehalfOf: string | undefined
    if (a.on_behalf_of !== undefined) {
      if (typeof a.on_behalf_of !== 'string' || !a.on_behalf_of.trim()) {
        throw new Error(`Agent ${id} has invalid on_behalf_of: must be a non-empty string`)
      }
      onBehalfOf = a.on_behalf_of.trim()
      if (!EMAIL_RE.test(onBehalfOf)) {
        throw new Error(`Agent ${id} on_behalf_of is not a valid email: ${onBehalfOf}`)
      }
      if (!seenEmails.has(onBehalfOf)) {
        throw new Error(`Agent ${id} on_behalf_of references unknown user: ${onBehalfOf}`)
      }
    }

    // Caps only narrow a delegated agent; pure agents are granted via [[iam]] agent: rules.
    let permissions: Permission[] | undefined
    if (a.permissions !== undefined) {
      if (!onBehalfOf) {
        throw new Error(`Agent ${id}: 'permissions' cap requires on_behalf_of (pure agents are granted via [[iam]] rules with agent:${id})`)
      }
      permissions = parsePermissionList(a.permissions, `Agent ${id} permissions`)
    }

    let connections: string[] | undefined
    if (a.connections !== undefined) {
      if (!onBehalfOf) {
        throw new Error(`Agent ${id}: 'connections' cap requires on_behalf_of`)
      }
      if (!Array.isArray(a.connections)) {
        throw new Error(`Agent ${id} connections must be an array`)
      }
      connections = []
      for (const rawCid of a.connections) {
        if (typeof rawCid !== 'string' || !rawCid.trim()) {
          throw new Error(`Agent ${id} has invalid connection id: must be a non-empty string`)
        }
        const cid = rawCid.trim()
        if (!seenIds.has(cid)) {
          throw new Error(`Agent ${id} references unknown connection: ${cid}`)
        }
        connections.push(cid)
      }
    }

    agents.push({ id, name, token, onBehalfOf, permissions, connections })
  }

  // Parse and validate IAM rules
  const iam: IAMRule[] = []
  const rawIAM = (parsed as { iam?: unknown[] }).iam || []

  for (let i = 0; i < rawIAM.length; i++) {
    const rule = rawIAM[i] as Record<string, unknown>
    const ruleNum = i + 1

    // Validate connection
    if (!rule.connection || typeof rule.connection !== 'string') {
      throw new Error(`IAM rule ${ruleNum} missing required field: connection`)
    }
    const connection = rule.connection.trim()
    if (connection !== '*' && !seenIds.has(connection)) {
      throw new Error(`IAM rule ${ruleNum} references unknown connection: ${connection}`)
    }

    // Validate permissions
    const permissions = parsePermissionList(rule.permissions, `IAM rule ${ruleNum} permissions`)

    // Validate members
    if (!Array.isArray(rule.members) || rule.members.length === 0) {
      throw new Error(`IAM rule ${ruleNum} missing required field: members (must be non-empty array)`)
    }
    const members: string[] = []
    for (const member of rule.members) {
      if (typeof member !== 'string' || !member.trim()) {
        throw new Error(`IAM rule ${ruleNum} has invalid member: must be non-empty string`)
      }
      const m = member.trim()
      if (m === '*') {
        members.push(m)
      } else if (m.startsWith('user:')) {
        const email = m.slice(5)
        if (!email) {
          throw new Error(`IAM rule ${ruleNum} has invalid member: user: prefix requires an email`)
        }
        members.push(m)
      } else if (m.startsWith('group:')) {
        const groupId = m.slice(6)
        if (!groupId) {
          throw new Error(`IAM rule ${ruleNum} has invalid member: group: prefix requires a group ID`)
        }
        if (!seenGroupIds.has(groupId)) {
          throw new Error(`IAM rule ${ruleNum} references unknown group: ${groupId}`)
        }
        members.push(m)
      } else if (m.startsWith('agent:')) {
        const agentId = m.slice(6)
        if (!agentId) {
          throw new Error(`IAM rule ${ruleNum} has invalid member: agent: prefix requires an agent ID`)
        }
        if (!seenAgentIds.has(agentId)) {
          throw new Error(`IAM rule ${ruleNum} references unknown agent: ${agentId}`)
        }
        members.push(m)
      } else {
        throw new Error(`IAM rule ${ruleNum} has invalid member format: ${m}. Must be "*", "user:xxx", "group:xxx", or "agent:xxx"`)
      }
    }

    iam.push({ connection, permissions, members })
  }

  loadedConfig = { external_url, banner, branding, users, groups, labels, connections, auth, ai, agents, iam }
}

export function getLabels(): LabelConfig[] {
  return loadedConfig.labels
}

export function getGroups(): GroupConfig[] {
  return loadedConfig.groups
}

export function getGroupById(id: string): GroupConfig | undefined {
  return loadedConfig.groups.find((g) => g.id === id)
}

export function getGroupsForUser(email: string): GroupConfig[] {
  return loadedConfig.groups.filter((g) => g.members.includes(email))
}

export function getConnections(): ConnectionConfig[] {
  return loadedConfig.connections
}

export function getConnectionById(id: string): ConnectionConfig | undefined {
  return loadedConfig.connections.find((c) => c.id === id)
}

export function getAuthConfig(): AuthConfig | undefined {
  return loadedConfig.auth
}

export function getAuthProvider(type: string): AuthProviderConfig | undefined {
  return loadedConfig.auth?.providers.find((p) => p.type === type)
}

export function getUsers(): UserConfig[] {
  return loadedConfig.users
}

export function getUserByEmail(email: string): UserConfig | undefined {
  return loadedConfig.users.find((u) => u.email === email)
}

export function isOwner(email: string): boolean {
  return getUserByEmail(email)?.owner === true
}

export function isAuthEnabled(): boolean {
  return loadedConfig.auth !== undefined
}

export function getExternalUrl(): string | undefined {
  return loadedConfig.external_url?.replace(/\/+$/, '')
}

export function getBanner(): BannerConfig | undefined {
  return loadedConfig.banner
}

export function getBranding(): BrandingConfig | undefined {
  return loadedConfig.branding
}

export function getAIConfig(): AIConfig | undefined {
  return loadedConfig.ai
}

export function getAIProviders(): AIProviderConfig[] {
  return loadedConfig.ai?.providers ?? []
}

export function getAIProviderById(id: string): AIProviderConfig | undefined {
  return loadedConfig.ai?.providers.find((p) => p.id === id)
}

export function getAgents(): AgentConfig[] {
  return loadedConfig.agents
}

export function getAgentById(id: string): AgentConfig | undefined {
  return loadedConfig.agents.find((a) => a.id === id)
}

// Resolve an MCP bearer token to the agent it authenticates. Returns undefined for unknown tokens.
export function getAgentByToken(token: string): AgentConfig | undefined {
  return loadedConfig.agents.find((a) => a.token === token)
}

export function getIAMRules(): IAMRule[] {
  return loadedConfig.iam
}

export function loadDemoConfig(port: number): void {
  demoMode = true
  loadedConfig = {
    ...DEFAULT_CONFIG,
    connections: [{
      id: 'demo',
      name: 'Demo Database',
      host: '127.0.0.1',
      port,
      database: 'postgres',
      username: 'postgres',
      ssl_mode: 'disable',
    }],
  }
}

export function isDemoMode(): boolean {
  return demoMode
}
