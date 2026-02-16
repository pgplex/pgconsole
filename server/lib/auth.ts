import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import type { Request } from 'express'
import { getAuthConfig, getUserByEmail } from './config'

export interface TokenPayload extends JWTPayload {
  sub: string // email
  name?: string // display name (only if different from sub)
  idp?: 'google' | 'keycloak' | 'okta' // identity provider (omitted for basic auth)
  avatar?: string // avatar URL (Google profile picture)
}

export interface User {
  email: string
  name: string
  idp?: 'google' | 'keycloak' | 'okta' // omitted for basic auth
  avatar?: string // avatar URL (Google profile picture)
}

const DEFAULT_SIGNIN_EXPIRY = '7d'

// Validate expiry format like "7d", "24h", "2w"
function parseExpiry(expiry: string): string {
  const match = expiry.trim().match(/^(\d+)([hdw])$/i)
  if (!match) {
    console.warn(`Invalid signin_expiry format: "${expiry}", using default "${DEFAULT_SIGNIN_EXPIRY}"`)
    return DEFAULT_SIGNIN_EXPIRY
  }
  return `${match[1]}${match[2].toLowerCase()}`
}

function getSecretKey(): Uint8Array {
  const config = getAuthConfig()
  if (!config) {
    throw new Error('Auth not configured')
  }
  return new TextEncoder().encode(config.jwt_secret)
}

export async function createToken(user: User): Promise<string> {
  const config = getAuthConfig()
  const expiration = parseExpiry(config?.signin_expiry ?? DEFAULT_SIGNIN_EXPIRY)

  const payload: TokenPayload = {
    sub: user.email,
  }

  // Only include name if different from email
  if (user.name && user.name !== user.email) {
    payload.name = user.name
  }

  // Only include idp for OAuth users
  if (user.idp) {
    payload.idp = user.idp
  }

  // Include avatar if available
  if (user.avatar) {
    payload.avatar = user.avatar
  }

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('pgconsole')
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(getSecretKey())

  return token
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    return payload as TokenPayload
  } catch {
    return null
  }
}

export async function authenticateBasic(
  email: string,
  password: string
): Promise<User | null> {
  const user = getUserByEmail(email)
  if (!user || !user.password) {
    return null
  }

  // Simple plaintext comparison for TOML-configured users
  if (user.password !== password) {
    return null
  }

  return {
    email: user.email,
    name: user.email,
  }
}

const COOKIE_NAME = 'pgconsole_token'

/**
 * Extract the current user from request cookies.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(req: Request): Promise<User | null> {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) {
    return null
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return null
  }

  return {
    email: payload.sub,
    name: payload.name || payload.sub,
    idp: payload.idp,
    avatar: payload.avatar,
  }
}
