import { useState, useEffect } from 'react'

// Uses relative URLs - works with Vite proxy in dev and same-origin server in prod

export interface User {
  email: string
  name: string
  avatar?: string
}

interface SessionState {
  user: User | null
  isPending: boolean
  serverError: boolean
  authEnabled: boolean
  isOwner: boolean
}

export function useSession() {
  const [state, setState] = useState<SessionState>({
    user: null,
    isPending: true,
    serverError: false,
    authEnabled: false,
    isOwner: false,
  })

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'include' })
      .then(async (r) => {
        // Server responded - not a network error
        // Try to parse JSON, but don't fail if it's not valid
        try {
          const data = await r.json()
          setState({
            user: data.user ?? null,
            isPending: false,
            serverError: false,
            authEnabled: data.authEnabled ?? false,
            isOwner: data.isOwner ?? false,
          })
        } catch {
          // Server responded but not with JSON - still not a "server down" error
          setState({ user: null, isPending: false, serverError: false, authEnabled: false, isOwner: false })
        }
      })
      .catch(() => {
        // Network error - server is unreachable
        setState({ user: null, isPending: false, serverError: true, authEnabled: false, isOwner: false })
      })
  }, [])

  return state
}

export async function signIn(email: string, password: string): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const data = await res.json()
      return data.error || 'Login failed'
    }
    return null
  } catch {
    return 'Network error'
  }
}

export async function signOut() {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {})
}

export interface AuthProvider {
  name: string
  requiredPlan?: string
}

export async function getProviders(): Promise<AuthProvider[]> {
  try {
    const res = await fetch('/api/auth/providers', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      return data.providers || []
    }
  } catch {}
  return []
}
