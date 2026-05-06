import { describe, it, expect } from 'vitest'
import { hitTestHover } from '../useLivelineEngine'
import type { ChartLayout, LivelinePoint, Padding } from '../types'

function fakePad(): Required<Padding> {
  return { top: 12, right: 80, bottom: 28, left: 12 }
}

function fakeLayout(): ChartLayout {
  const w = 400, h = 200, pad = fakePad()
  return {
    w, h, pad,
    chartW: w - pad.left - pad.right,
    chartH: h - pad.top - pad.bottom,
    leftEdge: 0, rightEdge: 30,
    minVal: 100, maxVal: 200, valRange: 100,
    toX: (t: number) => pad.left + (t / 30) * (w - pad.left - pad.right),
    toY: (v: number) => pad.top + (1 - (v - 100) / 100) * (h - pad.top - pad.bottom),
  }
}

const visible: LivelinePoint[] = [
  { time: 0, value: 100 },
  { time: 15, value: 150 },
  { time: 30, value: 200 },
]

describe('hitTestHover', () => {
  it('returns null when pointer is outside the chart area', () => {
    const result = hitTestHover({
      hoverPixelX: 5,
      pad: fakePad(),
      w: 400,
      layout: fakeLayout(),
      now: 30,
      visible,
      leftEdge: 0,
      rightEdge: 30,
      chartW: 308,
    })
    expect(result).toBeNull()
  })

  it('returns null when pointer is past the right edge', () => {
    const result = hitTestHover({
      hoverPixelX: 350,
      pad: fakePad(),
      w: 400,
      layout: fakeLayout(),
      now: 30,
      visible,
      leftEdge: 0,
      rightEdge: 30,
      chartW: 308,
    })
    expect(result).toBeNull()
  })

  it('returns interpolated value at midpoint', () => {
    const layout = fakeLayout()
    const midX = layout.toX(15)
    const result = hitTestHover({
      hoverPixelX: midX,
      pad: fakePad(),
      w: 400,
      layout,
      now: 30,
      visible,
      leftEdge: 0,
      rightEdge: 30,
      chartW: layout.chartW,
    })
    expect(result).not.toBeNull()
    expect(result!.value).toBeCloseTo(150, 1)
    expect(result!.time).toBeCloseTo(15, 1)
  })

  it('clamps the hover X to now', () => {
    const layout = fakeLayout()
    const tooFar = layout.toX(40)
    const nowX = layout.toX(30)
    const result = hitTestHover({
      hoverPixelX: Math.min(tooFar, layout.w - layout.pad.right),
      pad: fakePad(),
      w: 400,
      layout,
      now: 30,
      visible,
      leftEdge: 0,
      rightEdge: 30,
      chartW: layout.chartW,
    })
    expect(result).not.toBeNull()
    expect(result!.x).toBeCloseTo(nowX, 1)
  })
})
