import type { Request, CookieOptions } from 'express'

export interface OAuthOpts {
  cookieName: string
  cookieOptions: CookieOptions
  stateCookie: string
  stateCookieOptions: CookieOptions
  generateState: () => string
  getClientIp: (req: Request) => string
}
