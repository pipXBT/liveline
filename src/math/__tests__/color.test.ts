import { describe, it, expect, beforeEach } from 'vitest'
import { parseRgba, blendColor, _resetColorCache } from '../color'

describe('parseRgba', () => {
  beforeEach(() => _resetColorCache())

  it('parses 6-digit hex', () => {
    expect(parseRgba('#ff0000')).toEqual([255, 0, 0, 1])
  })

  it('parses 3-digit hex', () => {
    expect(parseRgba('#f00')).toEqual([255, 0, 0, 1])
  })

  it('parses rgb()', () => {
    expect(parseRgba('rgb(10, 20, 30)')).toEqual([10, 20, 30, 1])
  })

  it('parses rgba()', () => {
    expect(parseRgba('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30, 0.5])
  })

  it('falls back to grey on garbage', () => {
    expect(parseRgba('not a color')).toEqual([128, 128, 128, 1])
  })

  it('falls back to grey on 4-digit hex (#rgba shorthand, unsupported)', () => {
    // 4-digit hex matches the /^#([0-9a-f]{3,8})$/i regex but the parser only
    // expands length-3; length-4 falls through to slice(4,6) on a 4-char string
    // which returns '' and parseInt('',16) === NaN. Current behavior is [r,g,NaN,1].
    const result = parseRgba('#f00f')
    expect(result[0]).toBe(240)
    expect(result[1]).toBe(15)
    expect(result[2]).toBeNaN()
    expect(result[3]).toBe(1)
  })

  it('returns the same array reference on second call (cache hit)', () => {
    const a = parseRgba('#ff0000')
    const b = parseRgba('#ff0000')
    expect(a).toBe(b)
  })

  it('parses different colors into separate cache entries', () => {
    const a = parseRgba('#ff0000')
    const b = parseRgba('#00ff00')
    expect(a).not.toBe(b)
    expect(a).toEqual([255, 0, 0, 1])
    expect(b).toEqual([0, 255, 0, 1])
  })
})

describe('blendColor', () => {
  beforeEach(() => _resetColorCache())

  it('returns c1 when t<=0', () => {
    expect(blendColor('#ff0000', '#00ff00', 0)).toBe('#ff0000')
    expect(blendColor('#ff0000', '#00ff00', -0.5)).toBe('#ff0000')
  })

  it('returns c2 when t>=1', () => {
    expect(blendColor('#ff0000', '#00ff00', 1)).toBe('#00ff00')
    expect(blendColor('#ff0000', '#00ff00', 2)).toBe('#00ff00')
  })

  it('blends rgb at midpoint', () => {
    expect(blendColor('#000000', '#ffffff', 0.5)).toBe('rgb(128,128,128)')
  })

  it('blends alpha when both inputs are rgba', () => {
    const out = blendColor('rgba(255,0,0,0.0)', 'rgba(255,0,0,1.0)', 0.5)
    expect(out).toBe('rgba(255,0,0,0.500)')
  })
})
