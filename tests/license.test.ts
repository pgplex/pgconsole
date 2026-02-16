import { describe, it, expect, beforeAll } from 'vitest'
import { SignJWT, exportSPKI, generateKeyPair } from 'jose'
import { checkLicense, setPublicKeyForTesting } from '../server/lib/license'

let privateKey: CryptoKey
let publicKey: CryptoKey

async function mintJWT(claims: Record<string, unknown>, opts?: { key?: CryptoKey; expiresIn?: string }) {
  const key = opts?.key ?? privateKey
  let builder = new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('pgconsole/license')
    .setSubject('lic_test-uuid')
  if (opts?.expiresIn) {
    builder = builder.setExpirationTime(opts.expiresIn)
  } else {
    builder = builder.setExpirationTime('1h')
  }
  return builder.sign(key)
}

describe('checkLicense', () => {
  beforeAll(async () => {
    const pair = await generateKeyPair('RS256')
    privateKey = pair.privateKey
    publicKey = pair.publicKey
    const pem = await exportSPKI(publicKey)
    setPublicKeyForTesting(pem)
  })

  it('returns TEAM for valid TEAM license', async () => {
    const jwt = await mintJWT({ plan: 'team', email: 'a@b.com' })
    const result = await checkLicense(jwt)
    expect(result.plan).toBe('TEAM')
    expect(result.expiry).toBeTypeOf('number')
  })

  it('returns ENTERPRISE for valid ENTERPRISE license', async () => {
    const jwt = await mintJWT({ plan: 'enterprise', email: 'a@b.com' })
    expect((await checkLicense(jwt)).plan).toBe('ENTERPRISE')
  })

  it('returns FREE for expired license', async () => {
    const jwt = await mintJWT({ plan: 'team', email: 'a@b.com' }, { expiresIn: '-1s' })
    expect((await checkLicense(jwt)).plan).toBe('FREE')
  })

  it('returns FREE for invalid signature', async () => {
    const wrongPair = await generateKeyPair('RS256')
    const jwt = await mintJWT({ plan: 'team', email: 'a@b.com' }, { key: wrongPair.privateKey })
    expect((await checkLicense(jwt)).plan).toBe('FREE')
  })

  it('returns FREE for unknown plan value', async () => {
    const jwt = await mintJWT({ plan: 'BOGUS', email: 'a@b.com' })
    expect((await checkLicense(jwt)).plan).toBe('FREE')
  })

  it('returns FREE for missing plan claim', async () => {
    const jwt = await mintJWT({ email: 'a@b.com' })
    expect((await checkLicense(jwt)).plan).toBe('FREE')
  })

  it('returns FREE for garbage string', async () => {
    expect((await checkLicense('not-a-jwt')).plan).toBe('FREE')
  })

  it('returns FREE for empty string', async () => {
    expect((await checkLicense('')).plan).toBe('FREE')
  })

  // maxUsers tests
  it('returns maxUsers from user claim', async () => {
    const jwt = await mintJWT({ plan: 'team', userSeat: 5 })
    const result = await checkLicense(jwt)
    expect(result.maxUsers).toBe(5)
  })

  it('returns maxUsers=1 when user claim is missing', async () => {
    const jwt = await mintJWT({ plan: 'team' })
    const result = await checkLicense(jwt)
    expect(result.maxUsers).toBe(1)
  })

  it('returns maxUsers=1 for invalid license', async () => {
    const result = await checkLicense('invalid-jwt')
    expect(result.plan).toBe('FREE')
    expect(result.maxUsers).toBe(1)
  })

  it('returns maxUsers=1 when user claim is non-numeric string', async () => {
    const jwt = await mintJWT({ plan: 'team', userSeat: 'five' })
    const result = await checkLicense(jwt)
    expect(result.maxUsers).toBe(1)
  })

  it('returns maxUsers=0 when user claim is zero', async () => {
    const jwt = await mintJWT({ plan: 'team', userSeat: 0 })
    const result = await checkLicense(jwt)
    expect(result.maxUsers).toBe(0)
  })

  it('returns negative maxUsers when user claim is negative', async () => {
    const jwt = await mintJWT({ plan: 'team', userSeat: -1 })
    const result = await checkLicense(jwt)
    expect(result.maxUsers).toBe(-1)
  })

  // email tests
  it('returns email from email claim', async () => {
    const jwt = await mintJWT({ plan: 'team', email: 'customer@example.com' })
    const result = await checkLicense(jwt)
    expect(result.email).toBe('customer@example.com')
  })

  it('returns undefined email when email claim is missing', async () => {
    const jwt = await mintJWT({ plan: 'team' })
    const result = await checkLicense(jwt)
    expect(result.email).toBeUndefined()
  })
})
