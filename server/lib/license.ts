import { jwtVerify, importSPKI } from 'jose'
import type { PlanTier } from '../../src/lib/plan'

export interface LicenseResult {
  plan: PlanTier
  expiry?: number
  maxUsers: number
  email?: string
}

const LICENSE_ISSUER = 'pgconsole/license'

let KEYGEN_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuNGFvPtpvyhT7eYc1x5Y
ir/nW5CAH3kLYL3F70xN5bMYxsx9h9H/4xBIAk3ddm/maOqcua2E+PI2Z1w8lEtR
GhAXSJtykKGuPXIDudnMVXbYqYhvvVYTH4NXRtTuS5NdTD0ZURr6X8X01dIsJVve
QUp/TXODV0GHTRvkRdisak3NUnub9Mv20XirYWPed1OnDWLuE57T1FaD6ZYhC0is
loNCg5i7KfmNxigW/iABe7Pbvafuq5O5UBkN9l7x+kcnc68oY/ceBUnyHa8Hj3p6
B5IyYLTs5y7dD1IS22hJiteOQEmmdOQpYCXyOhVRXcuVHzHYkQNNvlW9vDVTE+m7
rQIDAQAB
-----END PUBLIC KEY-----`

export function setPublicKeyForTesting(pem: string): void {
  KEYGEN_PUBLIC_KEY = pem
}

export async function checkLicense(license: string): Promise<LicenseResult> {
  try {
    const publicKey = await importSPKI(KEYGEN_PUBLIC_KEY, 'RS256')
    const { payload } = await jwtVerify(license, publicKey, {
      issuer: LICENSE_ISSUER,
      requiredClaims: ['exp'],
    })
    const plan = payload.plan as string
    const maxUsers = typeof payload.userSeat === 'number' ? payload.userSeat : 1
    const email = typeof payload.email === 'string' ? payload.email : undefined
    if (plan === 'team' || plan === 'enterprise') {
      return { plan: plan.toUpperCase() as PlanTier, expiry: payload.exp, maxUsers, email }
    }
    console.warn('License JWT has unrecognized plan claim:', plan)
    return { plan: 'FREE', maxUsers: 1 }
  } catch (err) {
    console.warn('License verification failed:', err instanceof Error ? err.message : err)
    return { plan: 'FREE', maxUsers: 1 }
  }
}
