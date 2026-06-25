import { Router, type Request, type Response } from 'express'
import crypto from 'crypto'
import { createToken, verifyToken, authenticateBasic } from './lib/auth'
import { getAuthConfig, isAuthEnabled, getGroupsForUser, isOwner, getUsers } from './lib/config'
import { auditLogin, auditLogout } from './lib/audit'
import { registerGoogleOAuth } from './lib/oauth/google'
import { registerKeycloakOAuth } from './lib/oauth/keycloak'
import { registerOktaOAuth } from './lib/oauth/okta'

const router = Router()

const COOKIE_NAME = 'pgconsole_token'
const OAUTH_STATE_COOKIE = 'pgconsole_oauth_state'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
}
const STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 10 * 60 * 1000, // 10 minutes
  path: '/',
}

function generateState(): string {
  return crypto.randomBytes(32).toString('hex')
}

const GUEST_USER = { email: 'guest', name: 'Guest', groups: [] as string[] }

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  return req.ip || 'unknown'
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  if (!isAuthEnabled()) {
    return res.status(400).json({ error: 'Authentication not configured' })
  }

  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }

  const user = await authenticateBasic(email, password)
  const ip = getClientIp(req)
  if (!user) {
    auditLogin(email, 'basic', ip, false, 'Invalid credentials')
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = await createToken(user)
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS)
  auditLogin(user.email, 'basic', ip, true)
  const groups = getGroupsForUser(user.email).map((g) => g.id)
  return res.json({ user: { ...user, groups } })
})

// GET /api/auth/session
router.get('/session', async (req: Request, res: Response) => {
  const authEnabled = isAuthEnabled()

  // If auth not configured, return guest user
  if (!authEnabled) {
    return res.json({ user: GUEST_USER, authEnabled: false })
  }

  const token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    return res.json({ user: null, authEnabled: true })
  }

  const payload = await verifyToken(token)
  if (!payload) {
    res.clearCookie(COOKIE_NAME, { path: '/' })
    return res.json({ user: null, authEnabled: true })
  }

  const email = payload.sub
  const groups = getGroupsForUser(email).map((g) => g.id)

  return res.json({
    user: { email, name: payload.name || email, groups, avatar: payload.avatar },
    authEnabled: true,
    isOwner: isOwner(email),
  })
})

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_NAME]
  if (token) {
    const payload = await verifyToken(token)
    if (payload?.sub) {
      auditLogout(payload.sub)
    }
  }
  res.clearCookie(COOKIE_NAME, { path: '/' })
  return res.json({ success: true })
})

// OAuth providers
const oauthOpts = {
  cookieName: COOKIE_NAME,
  cookieOptions: COOKIE_OPTIONS,
  stateCookie: OAUTH_STATE_COOKIE,
  stateCookieOptions: STATE_COOKIE_OPTIONS,
  generateState,
  getClientIp,
}
registerGoogleOAuth(router, oauthOpts)
registerKeycloakOAuth(router, oauthOpts)
registerOktaOAuth(router, oauthOpts)

// GET /api/auth/providers
router.get('/providers', (_req: Request, res: Response) => {
  if (!isAuthEnabled()) {
    return res.json({ providers: [] })
  }

  const config = getAuthConfig()
  const providers: Array<{ name: string }> = []
  if (getUsers().some(u => u.password)) providers.push({ name: 'basic' })
  for (const provider of config?.providers ?? []) {
    providers.push({ name: provider.type })
  }

  return res.json({ providers })
})

export const authRouter = router
