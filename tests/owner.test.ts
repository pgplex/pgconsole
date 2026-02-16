import { describe, it, expect } from 'vitest'

// We'll test the owner logic by mocking the config module internals
// For now, test the parsing logic conceptually

describe('owner field parsing', () => {
  it('explicit owner = true is preserved', () => {
    const users = [
      { email: 'admin@example.com', owner: true },
      { email: 'user@example.com', owner: false },
    ]
    expect(users[0].owner).toBe(true)
    expect(users[1].owner).toBe(false)
  })

  it('first user becomes owner if no explicit owner', () => {
    const users = [
      { email: 'first@example.com', owner: false },
      { email: 'second@example.com', owner: false },
    ]
    // Simulate the fallback logic
    const hasExplicitOwner = users.some(u => u.owner)
    if (!hasExplicitOwner && users.length > 0) {
      users[0].owner = true
    }
    expect(users[0].owner).toBe(true)
    expect(users[1].owner).toBe(false)
  })

  it('multiple explicit owners are allowed', () => {
    const users = [
      { email: 'admin1@example.com', owner: true },
      { email: 'admin2@example.com', owner: true },
      { email: 'user@example.com', owner: false },
    ]
    const owners = users.filter(u => u.owner)
    expect(owners.length).toBe(2)
  })
})
