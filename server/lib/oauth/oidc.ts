import type { Router, Request, Response } from 'express'
import { createToken, type User } from '../auth'
import { getAuthProvider, getExternalUrl, getUserByEmail } from '../config'
import { auditLogin } from '../audit'
import type { OAuthOpts } from './types'

interface OidcEndpoints {
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
}

let cachedEndpoints: OidcEndpoints | undefined

// Resolve endpoints from the OIDC discovery document, cached after first success
async function getEndpoints(issuerUrl: string): Promise<OidcEndpoints> {
  if (cachedEndpoints) return cachedEndpoints

  const res = await fetch(`${issuerUrl}/.well-known/openid-configuration`)
  if (!res.ok) {
    throw new Error(`OIDC discovery failed: ${res.status}`)
  }
  const doc = await res.json()
  if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.userinfo_endpoint) {
    throw new Error('OIDC discovery document missing required endpoints')
  }
  cachedEndpoints = {
    authorization_endpoint: doc.authorization_endpoint,
    token_endpoint: doc.token_endpoint,
    userinfo_endpoint: doc.userinfo_endpoint,
  }
  return cachedEndpoints
}

export function registerOidcOAuth(router: Router, opts: OAuthOpts): void {
  // GET /api/auth/oidc
  router.get('/oidc', async (_req: Request, res: Response) => {
    const oidc = getAuthProvider('oidc')
    if (!oidc) {
      return res.status(400).json({ error: 'OIDC not configured' })
    }

    let endpoints: OidcEndpoints
    try {
      endpoints = await getEndpoints(oidc.issuer_url!)
    } catch (err) {
      console.error('[oidc]', err)
      return res.status(502).json({ error: 'OIDC discovery failed' })
    }

    const state = opts.generateState()
    res.cookie(opts.stateCookie, state, opts.stateCookieOptions)

    const externalUrl = getExternalUrl()!
    const params = new URLSearchParams({
      client_id: oidc.client_id,
      redirect_uri: `${externalUrl}/api/auth/oidc/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    })
    return res.redirect(`${endpoints.authorization_endpoint}?${params}`)
  })

  // GET /api/auth/oidc/callback
  router.get('/oidc/callback', async (req: Request, res: Response) => {
    const oidc = getAuthProvider('oidc')
    const externalUrl = getExternalUrl()!

    if (!oidc) {
      return res.redirect(`${externalUrl}/signin?error=not_configured`)
    }

    // Check for OAuth error response
    const { error, code, state } = req.query
    if (error) {
      res.clearCookie(opts.stateCookie, { path: '/' })
      return res.redirect(`${externalUrl}/signin?error=${encodeURIComponent(String(error))}`)
    }

    // Validate state parameter (CSRF protection)
    const savedState = req.cookies?.[opts.stateCookie]
    res.clearCookie(opts.stateCookie, { path: '/' })
    if (!state || !savedState || state !== savedState) {
      return res.redirect(`${externalUrl}/signin?error=invalid_state`)
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${externalUrl}/signin?error=no_code`)
    }

    try {
      const endpoints = await getEndpoints(oidc.issuer_url!)

      const tokenRes = await fetch(endpoints.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: oidc.client_id,
          client_secret: oidc.client_secret,
          redirect_uri: `${externalUrl}/api/auth/oidc/callback`,
          grant_type: 'authorization_code',
        }),
      })
      if (!tokenRes.ok) {
        return res.redirect(`${externalUrl}/signin?error=token_failed`)
      }

      const tokens = await tokenRes.json()
      const userRes = await fetch(endpoints.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (!userRes.ok) {
        return res.redirect(`${externalUrl}/signin?error=userinfo_failed`)
      }

      const userInfo = await userRes.json()

      // Require email as the identity
      if (!userInfo.email) {
        return res.redirect(`${externalUrl}/signin?error=no_email`)
      }

      // Check user is in [[users]] list
      if (!getUserByEmail(userInfo.email)) {
        return res.redirect(`${externalUrl}/signin?error=user_not_allowed`)
      }

      // Build display name from first/last name, falling back to full name or email
      const displayName =
        userInfo.given_name && userInfo.family_name
          ? `${userInfo.given_name} ${userInfo.family_name}`
          : userInfo.name || userInfo.email

      const user: User = {
        email: userInfo.email,
        name: displayName,
        idp: 'oidc',
      }

      const token = await createToken(user)
      res.cookie(opts.cookieName, token, opts.cookieOptions)
      auditLogin(user.email, 'oidc', opts.getClientIp(req), true)
      return res.redirect(externalUrl)
    } catch {
      auditLogin('unknown', 'oidc', opts.getClientIp(req), false, 'OIDC OAuth error')
      return res.redirect(`${externalUrl}/signin?error=oauth_error`)
    }
  })
}
