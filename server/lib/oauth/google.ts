import type { Router, Request, Response } from 'express'
import { createToken, type User } from '../auth'
import { getAuthProvider, getExternalUrl, getUserByEmail } from '../config'
import { auditLogin } from '../audit'
import type { OAuthOpts } from './types'

export function registerGoogleOAuth(router: Router, opts: OAuthOpts): void {
  // GET /api/auth/google
  router.get('/google', (_req: Request, res: Response) => {
    const google = getAuthProvider('google')
    if (!google) {
      return res.status(400).json({ error: 'Google OAuth not configured' })
    }

    const state = opts.generateState()
    res.cookie(opts.stateCookie, state, opts.stateCookieOptions)

    const externalUrl = getExternalUrl()!
    const params = new URLSearchParams({
      client_id: google.client_id,
      redirect_uri: `${externalUrl}/api/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    })
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  })

  // GET /api/auth/google/callback
  router.get('/google/callback', async (req: Request, res: Response) => {
    const google = getAuthProvider('google')
    const externalUrl = getExternalUrl()!

    if (!google) {
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
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: google.client_id,
          client_secret: google.client_secret,
          redirect_uri: `${externalUrl}/api/auth/google/callback`,
          grant_type: 'authorization_code',
        }),
      })
      if (!tokenRes.ok) {
        return res.redirect(`${externalUrl}/signin?error=token_failed`)
      }

      const tokens = await tokenRes.json()
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (!userRes.ok) {
        return res.redirect(`${externalUrl}/signin?error=userinfo_failed`)
      }

      const userInfo = await userRes.json()

      // Validate email exists and is verified
      if (!userInfo.email) {
        return res.redirect(`${externalUrl}/signin?error=no_email`)
      }
      if (userInfo.verified_email === false) {
        return res.redirect(`${externalUrl}/signin?error=email_not_verified`)
      }

      // Check user is in [[users]] list
      if (!getUserByEmail(userInfo.email)) {
        return res.redirect(`${externalUrl}/signin?error=user_not_allowed`)
      }

      const user: User = {
        email: userInfo.email,
        name: userInfo.name || userInfo.email,
        idp: 'google',
        avatar: userInfo.picture,
      }

      const token = await createToken(user)
      res.cookie(opts.cookieName, token, opts.cookieOptions)
      auditLogin(user.email, 'google', opts.getClientIp(req), true)
      return res.redirect(externalUrl)
    } catch {
      auditLogin('unknown', 'google', opts.getClientIp(req), false, 'Google OAuth error')
      return res.redirect(`${externalUrl}/signin?error=oauth_error`)
    }
  })
}
