import { describe, it, expect } from 'vitest'
import { createRecordCtx } from './recordCtx'

describe('recordCtx', () => {
  it('records method calls in order', () => {
    const { ctx, trace } = createRecordCtx()
    ctx.beginPath()
    ctx.moveTo(1, 2)
    ctx.lineTo(3, 4)
    ctx.stroke()
    expect(trace).toEqual([
      ['beginPath'],
      ['moveTo', 1, 2],
      ['lineTo', 3, 4],
      ['stroke'],
    ])
  })

  it('records property assignments as set events', () => {
    const { ctx, trace } = createRecordCtx()
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = '#ff0000'
    expect(trace).toEqual([
      ['set', 'globalAlpha', 0.5],
      ['set', 'strokeStyle', '#ff0000'],
    ])
  })

  it('reads back the current globalAlpha so callers can multiply', () => {
    const { ctx } = createRecordCtx()
    ctx.globalAlpha = 0.5
    expect(ctx.globalAlpha).toBe(0.5)
  })

  it('save/restore tracks globalAlpha', () => {
    const { ctx } = createRecordCtx()
    ctx.globalAlpha = 0.3
    ctx.save()
    ctx.globalAlpha = 0.8
    ctx.restore()
    expect(ctx.globalAlpha).toBe(0.3)
  })

  it('measureText returns a width proportional to text length', () => {
    const { ctx } = createRecordCtx()
    expect(ctx.measureText('').width).toBe(0)
    expect(ctx.measureText('hi').width).toBeGreaterThan(0)
  })

  it('createLinearGradient returns an object with addColorStop', () => {
    const { ctx } = createRecordCtx()
    const g = ctx.createLinearGradient(0, 0, 100, 0)
    expect(typeof g.addColorStop).toBe('function')
    g.addColorStop(0, '#fff')
  })
})
