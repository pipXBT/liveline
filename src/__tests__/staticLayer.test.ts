import { describe, it, expect } from 'vitest'
import { drawStaticLayer, type StaticDrawOptions } from '../draw'
import { createRecordCtx } from './recordCtx'
import type { ChartLayout, LivelinePalette } from '../types'
import { createTimeAxisState } from '../draw/timeAxis'

function fakeLayout(): ChartLayout {
  const w = 400, h = 200
  const pad = { top: 12, right: 80, bottom: 28, left: 12 }
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

// Distinct sentinel colors so fillStyle changes can be attributed to the
// caller (grid label vs. time label) by inspecting the recorded trace.
const GRID_LABEL_COLOR = '#abc111'
const TIME_LABEL_COLOR = '#def222'

function fakePalette(): LivelinePalette {
  return {
    line: '#3b82f6',
    fillTop: 'rgba(0,0,0,0)',
    fillBottom: 'rgba(0,0,0,0)',
    dashLine: '#fff',
    gridLine: 'rgba(255,255,255,0.05)',
    gridLabel: GRID_LABEL_COLOR,
    timeLabel: TIME_LABEL_COLOR,
    tooltipBg: '#000',
    tooltipText: '#fff',
    badgeOuterBg: '#000',
    badgeOuterShadow: '#000',
    labelFont: '11px sans-serif',
    lineWidth: 2,
  } as unknown as LivelinePalette
}

describe('drawStaticLayer', () => {
  it('clears the canvas before painting', () => {
    const { ctx, trace } = createRecordCtx()
    const opts: StaticDrawOptions = {
      showGrid: true,
      gridState: { interval: 0, labels: new Map() },
      timeAxisState: createTimeAxisState(),
      windowSecs: 30,
      targetWindowSecs: 30,
      formatValue: (v) => v.toFixed(2),
      formatTime: (t) => String(t),
      dt: 16.67,
      chartReveal: 1,
    }
    drawStaticLayer(ctx, fakeLayout(), fakePalette(), opts)
    expect(trace[0]).toEqual(['clearRect', 0, 0, 400, 200])
  })

  it('skips grid when showGrid is false', () => {
    const palette = fakePalette()
    const { ctx, trace } = createRecordCtx()
    drawStaticLayer(ctx, fakeLayout(), palette, {
      showGrid: false,
      gridState: { interval: 0, labels: new Map() },
      timeAxisState: createTimeAxisState(),
      windowSecs: 30,
      targetWindowSecs: 30,
      formatValue: (v) => v.toFixed(2),
      formatTime: (t) => String(t),
      dt: 16.67,
      chartReveal: 1,
    })
    // Grid sets fillStyle = palette.gridLabel before drawing labels.
    // When showGrid is false, that fillStyle assignment must not appear.
    const setsGridLabel = trace.filter(
      e => e[0] === 'set' && e[1] === 'fillStyle' && e[2] === palette.gridLabel,
    )
    expect(setsGridLabel).toHaveLength(0)
  })
})
