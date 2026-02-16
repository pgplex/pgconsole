import type { Router, Request, Response } from 'express'
import { createToken, type User } from '../auth'
import { getAuthProvider, getExternalUrl, getUserByEmail } from '../config'
import { auditLogin } from '../audit'
import type { OAuthOpts } from './types'

export function registerKeycloakOAuth(router: Router, opts: OAuthOpts): void {
  // GET /api/auth/keycloak
  router.get('/keycloak', (_req: Request, res: Response) => {
    const keycloak = getAuthProvider('keycloak')
    if (!keycloak) {
      return res.status(400).json({ error: 'Keycloak not configured' })
    }

    const state = opts.generateState()
    res.cookie(opts.stateCookie, state, opts.stateCookieOptions)

    const externalUrl = getExternalUrl()!
    const params = new URLSearchParams({
      client_id: keycloak.client_id,
      redirect_uri: `${externalUrl}/api/auth/keycloak/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    })
    return res.redirect(`${keycloak.issuer_url}/protocol/openid-connect/auth?${params}`)
  })

  // GET /api/auth/keycloak/callback
  router.get('/keycloak/callback', async (req: Request, res: Response) => {
    const keycloak = getAuthProvider('keycloak')
    const externalUrl = getExternalUrl()!

    if (!keycloak) {
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
      const tokenRes = await fetch(`${keycloak.issuer_url}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: keycloak.client_id,
          client_secret: keycloak.client_secret,
          redirect_uri: `${externalUrl}/api/auth/keycloak/callback`,
          grant_type: 'authorization_code',
        }),
      })
      if (!tokenRes.ok) {
        return res.redirect(`${externalUrl}/signin?error=token_failed`)
      }

      const tokens = await tokenRes.json()
      const userRes = await fetch(`${keycloak.issuer_url}/protocol/openid-connect/userinfo`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (!userRes.ok) {
        return res.redirect(`${externalUrl}/signin?error=userinfo_failed`)
      }

      const userInfo = await userRes.json()

      // Require email as the identity, matching Google SSO behavior
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
        idp: 'keycloak',
      }

      const token = await createToken(user)
      res.cookie(opts.cookieName, token, opts.cookieOptions)
      auditLogin(user.email, 'keycloak', opts.getClientIp(req), true)
      return res.redirect(externalUrl)
    } catch {
      auditLogin('unknown', 'keycloak', opts.getClientIp(req), false, 'Keycloak OAuth error')
      return res.redirect(`${externalUrl}/signin?error=oauth_error`)
    }
  })
}
