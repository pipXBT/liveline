import { describe, it, expect } from 'vitest'
import { createTimeAxisState, getOrCreateLabel, expireLabel, iterateUsedLabels } from '../timeAxis'

describe('time axis label ring buffer', () => {
  it('createTimeAxisState exposes 32 slots, all unused', () => {
    const s = createTimeAxisState()
    let used = 0
    for (const _ of iterateUsedLabels(s)) used++
    expect(used).toBe(0)
  })

  it('getOrCreateLabel claims a free slot on first call', () => {
    const s = createTimeAxisState()
    const slot = getOrCreateLabel(s, 100)
    expect(slot.key).toBe(100)
    expect(slot.alpha).toBe(0)
    expect(slot.used).toBe(true)
  })

  it('getOrCreateLabel returns the same slot for the same key', () => {
    const s = createTimeAxisState()
    const a = getOrCreateLabel(s, 100)
    a.text = 'hello'
    a.alpha = 0.4
    const b = getOrCreateLabel(s, 100)
    expect(b).toBe(a)
    expect(b.text).toBe('hello')
    expect(b.alpha).toBe(0.4)
  })

  it('getOrCreateLabel allocates distinct slots for distinct keys', () => {
    const s = createTimeAxisState()
    const a = getOrCreateLabel(s, 100)
    const b = getOrCreateLabel(s, 200)
    expect(a).not.toBe(b)
    expect(a.key).toBe(100)
    expect(b.key).toBe(200)
  })

  it('expireLabel frees the slot for reuse', () => {
    const s = createTimeAxisState()
    const a = getOrCreateLabel(s, 100)
    expireLabel(a)
    expect(a.used).toBe(false)
    const b = getOrCreateLabel(s, 200)
    expect(b).toBe(a)
    expect(b.key).toBe(200)
    expect(b.alpha).toBe(0)
  })

  it('iterateUsedLabels skips unused slots', () => {
    const s = createTimeAxisState()
    getOrCreateLabel(s, 100)
    const b = getOrCreateLabel(s, 200)
    expireLabel(b)
    getOrCreateLabel(s, 300)
    const keys = [...iterateUsedLabels(s)].map(slot => slot.key).sort()
    expect(keys).toEqual([100, 300])
  })

  it('evicts the lowest-alpha slot when full (32 keys, then a 33rd)', () => {
    const s = createTimeAxisState()
    for (let i = 0; i < 32; i++) {
      const slot = getOrCreateLabel(s, i)
      slot.alpha = 0.5
    }
    const weakest = getOrCreateLabel(s, 5)
    weakest.alpha = 0.01
    const newSlot = getOrCreateLabel(s, 100)
    expect(newSlot.key).toBe(100)
    expect(newSlot.alpha).toBe(0)
    const keys = [...iterateUsedLabels(s)].map(s => s.key).sort((a, b) => a - b)
    expect(keys).not.toContain(5)
    expect(keys).toContain(100)
  })
})
