import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { storePlan, getPlan, removePlan } from '../server/lib/plan-store'

describe('plan-store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stores and retrieves a plan', () => {
    const planId = storePlan({
      connectionId: 'staging',
      planJsonPath: '/tmp/plan.json',
      planData: { diffs: [] },
    })

    const plan = getPlan(planId)
    expect(plan).toBeDefined()
    expect(plan!.connectionId).toBe('staging')
    expect(plan!.planJsonPath).toBe('/tmp/plan.json')
  })

  it('returns undefined for unknown plan', () => {
    expect(getPlan('nonexistent')).toBeUndefined()
  })

  it('removes a plan', () => {
    const planId = storePlan({
      connectionId: 'staging',
      planJsonPath: '/tmp/plan.json',
      planData: { diffs: [] },
    })

    removePlan(planId)
    expect(getPlan(planId)).toBeUndefined()
  })

  it('expires plans after 30 minutes', () => {
    const planId = storePlan({
      connectionId: 'staging',
      planJsonPath: '/tmp/plan.json',
      planData: { diffs: [] },
    })

    vi.advanceTimersByTime(31 * 60 * 1000)

    expect(getPlan(planId)).toBeUndefined()
  })

  it('returns plan before expiry', () => {
    const planId = storePlan({
      connectionId: 'staging',
      planJsonPath: '/tmp/plan.json',
      planData: { diffs: [] },
    })

    vi.advanceTimersByTime(29 * 60 * 1000)

    expect(getPlan(planId)).toBeDefined()
  })
})
