import { parse } from 'smol-toml'
import { readFileSync, existsSync } from 'fs'
import { checkLicense } from './license'
import { feature } from '../../src/lib/plan'
import type { PlanTier } from '../../src/lib/plan'

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
  vendor: 'openai' | 'anthropic' | 'google'
  model: string
  api_key: string
}

export interface AIConfig {
  providers: AIProviderConfig[]
}

export interface BannerConfig {
  text: string
  link?: string
  color?: string
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
  license?: string
  banner?: BannerConfig
  users: UserConfig[]
  groups: GroupConfig[]
  labels: LabelConfig[]
  connections: ConnectionConfig[]
  auth?: AuthConfig
  ai?: AIConfig
  iam: IAMRule[]
  plan: PlanTier
  licenseExpiry?: number
  licenseMaxUsers: number
  licenseEmail?: string
}

const validSslModes = ['disable', 'prefer', 'require', 'verify-full']

const DEFAULT_CONFIG: Config = { users: [], groups: [], labels: [], connections: [], auth: undefined, ai: undefined, banner: undefined, license: undefined, iam: [], plan: 'FREE', licenseExpiry: undefined, licenseMaxUsers: 1, licenseEmail: undefined }

let loadedConfig: Config = { ...DEFAULT_CONFIG }
let demoMode = false

function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color)
}

export async function loadConfig(configPath: string): Promise<void> {
  demoMode = false

  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}\nSee https://docs.pgconsole.com/configuration/config`)
  }

  const content = readFileSync(configPath, 'utf-8')
  const parsed = parse(content) as { general?: Record<string, unknown>, users?: unknown[], groups?: unknown[], labels?: unknown[], connections?: unknown[], auth?: Record<string, unknown>, ai?: Record<string, unknown> }

  // Parse [general] section
  let external_url: string | undefined = undefined
  let license: string | undefined = undefined
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

    if (g.license !== undefined) {
      if (typeof g.license !== 'string') {
        throw new Error('general.license must be a string')
      }
      license = g.license
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
      members.push(member.trim())
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
    const validVendors = ['openai', 'anthropic', 'google']

    for (const provider of rawAI.providers) {
      const p = provider as Record<string, unknown>

      if (!p.id || typeof p.id !== 'string' || !p.id.trim()) {
        throw new Error('AI provider missing required field: id')
      }
      if (!p.vendor || typeof p.vendor !== 'string') {
        throw new Error(`AI provider ${p.id} missing required field: vendor`)
      }
      if (!validVendors.includes(p.vendor)) {
        throw new Error(`AI provider ${p.id} has invalid vendor: ${p.vendor}. Must be one of: ${validVendors.join(', ')}`)
      }
      if (!p.model || typeof p.model !== 'string') {
        throw new Error(`AI provider ${p.id} missing required field: model`)
      }
      if (!p.api_key || typeof p.api_key !== 'string') {
        throw new Error(`AI provider ${p.id} missing required field: api_key`)
      }

      const providerId = p.id.trim()
      if (seenProviderIds.has(providerId)) {
        throw new Error(`Duplicate AI provider ID: ${providerId}`)
      }
      seenProviderIds.add(providerId)

      providers.push({
        id: providerId,
        name: typeof p.name === 'string' ? p.name.trim() : providerId,
        vendor: p.vendor as 'openai' | 'anthropic' | 'google',
        model: p.model.trim(),
        api_key: p.api_key,
      })
    }

    if (providers.length > 0) {
      ai = { providers }
    }
  }

  // Parse and validate IAM rules
  const iam: IAMRule[] = []
  const validPermissions: Permission[] = ['read', 'write', 'ddl', 'admin', 'explain', 'execute', 'export']
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
    if (!Array.isArray(rule.permissions) || rule.permissions.length === 0) {
      throw new Error(`IAM rule ${ruleNum} missing required field: permissions (must be non-empty array)`)
    }
    const permissions: Permission[] = []
    for (const perm of rule.permissions) {
      if (typeof perm !== 'string') {
        throw new Error(`IAM rule ${ruleNum} has invalid permission: must be string`)
      }
      if (perm === '*') {
        permissions.push(...validPermissions)
      } else if (!validPermissions.includes(perm as Permission)) {
        throw new Error(`IAM rule ${ruleNum} has invalid permission: ${perm}. Must be one of: ${validPermissions.join(', ')}, *`)
      } else {
        permissions.push(perm as Permission)
      }
    }

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
      } else {
        throw new Error(`IAM rule ${ruleNum} has invalid member format: ${m}. Must be "*", "user:xxx", or "group:xxx"`)
      }
    }

    iam.push({ connection, permissions, members })
  }

  // Resolve license → plan tier and maxUsers before assigning config
  let plan: PlanTier = 'FREE'
  let licenseExpiry: number | undefined
  let licenseMaxUsers = 1
  let licenseEmail: string | undefined
  if (license) {
    const result = await checkLicense(license)
    plan = result.plan
    licenseExpiry = result.expiry
    licenseMaxUsers = result.maxUsers
    licenseEmail = result.email
  }

  loadedConfig = { external_url, license, banner, users, groups, labels, connections, auth, ai, iam, plan, licenseExpiry, licenseMaxUsers, licenseEmail }

  // Validate user count against license limit
  if (auth) {
    const limit = licenseMaxUsers
    if (users.length > limit) {
      throw new Error(`Too many [[users]] entries: ${users.length} configured but current license only allows ${limit}. Remove users or upgrade at https://docs.pgconsole.com/configuration/license#purchasing-a-license`)
    }
  }
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
  if (!feature('GROUPS', getPlan())) return []
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

export function getAIConfig(): AIConfig | undefined {
  return loadedConfig.ai
}

export function getAIProviders(): AIProviderConfig[] {
  return loadedConfig.ai?.providers ?? []
}

export function getAIProviderById(id: string): AIProviderConfig | undefined {
  return loadedConfig.ai?.providers.find((p) => p.id === id)
}

export function getIAMRules(): IAMRule[] {
  return loadedConfig.iam
}

export function getLicense(): string | undefined {
  return loadedConfig.license
}

export function getPlan(): PlanTier {
  return loadedConfig.plan
}

export function getLicenseExpiry(): number | undefined {
  return loadedConfig.licenseExpiry
}

export function getLicenseMaxUsers(): number {
  return loadedConfig.licenseMaxUsers
}

export function getLicenseEmail(): string | undefined {
  return loadedConfig.licenseEmail
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
