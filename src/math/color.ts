type Rgba = [number, number, number, number]

const cache = new Map<string, Rgba>()

/** For tests only — clear the parse cache. */
export function _resetColorCache(): void {
  cache.clear()
}

/** Parse a CSS color to [r, g, b, a]. Memoized — palette colors are stable. */
export function parseRgba(color: string): Rgba {
  const cached = cache.get(color)
  if (cached) return cached
  const parsed = parseRgbaUncached(color)
  cache.set(color, parsed)
  return parsed
}

function parseRgbaUncached(color: string): Rgba {
  const hex = color.match(/^#([0-9a-f]{3,8})$/i)
  if (hex) {
    let h = hex[1]
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]
  }
  const rgba = color.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)/)
  if (rgba) return [+rgba[1], +rgba[2], +rgba[3], +rgba[4]]
  const rgb = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3], 1]
  return [128, 128, 128, 1]
}

/** Lerp between two CSS colors. Cached parses; output is a fresh string. */
export function blendColor(c1: string, c2: string, t: number): string {
  if (t <= 0) return c1
  if (t >= 1) return c2
  const [r1, g1, b1, a1] = parseRgba(c1)
  const [r2, g2, b2, a2] = parseRgba(c2)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  const a = a1 + (a2 - a1) * t
  if (a >= 0.995) return `rgb(${r},${g},${b})`
  return `rgba(${r},${g},${b},${a.toFixed(3)})`
}
