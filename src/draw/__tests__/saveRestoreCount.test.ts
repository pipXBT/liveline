if (typeof globalThis.Path2D === 'undefined') {
  class Path2DStub {
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    closePath() {}
    addPath() {}
  }
  // @ts-expect-error global stub for tests
  globalThis.Path2D = Path2DStub
}

import { describe, it, expect } from 'vitest'
import { drawFrame, createShakeState, type DrawOptions, drawMultiFrame, type MultiSeriesDrawOptions } from '../index'
import { createRecordCtx, type TraceEvent } from '../../__tests__/recordCtx'
import type { ChartLayout, LivelinePalette, LivelinePoint } from '../../types'

function fakeLayout(): ChartLayout {
  const w = 400, h = 200
  const pad = { top: 12, right: 80, bottom: 28, left: 12 }
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom
  return {
    w, h, pad, chartW, chartH,
    leftEdge: 0, rightEdge: 30,
    minVal: 100, maxVal: 200, valRange: 100,
    toX: (t: number) => pad.left + (t / 30) * chartW,
    toY: (v: number) => pad.top + (1 - (v - 100) / 100) * chartH,
  }
}

function fakePalette(): LivelinePalette {
  return {
    line: '#3b82f6',
    fillTop: 'rgba(59,130,246,0.3)',
    fillBottom: 'rgba(59,130,246,0)',
    dashLine: 'rgba(255,255,255,0.2)',
    gridLine: 'rgba(255,255,255,0.05)',
    gridLabel: 'rgba(255,255,255,0.5)',
    timeLabel: 'rgba(255,255,255,0.5)',
    tooltipBg: 'rgba(0,0,0,0.8)',
    tooltipText: '#fff',
    badgeOuterBg: '#1a1a1a',
    badgeOuterShadow: 'rgba(0,0,0,0.5)',
    labelFont: '11px sans-serif',
    lineWidth: 2,
  }
}

function fakeOpts(visible: LivelinePoint[]): DrawOptions {
  return {
    visible,
    smoothValue: 150,
    now: 30,
    momentum: 'flat',
    arrowState: { up: 0, down: 0 },
    showGrid: true,
    showMomentum: true,
    showPulse: false,
    showFill: true,
    referenceLine: { value: 150, label: 'ref' },
    hoverX: null,
    hoverValue: null,
    hoverTime: null,
    scrubAmount: 0,
    windowSecs: 30,
    formatValue: (v: number) => v.toFixed(2),
    formatTime: (t: number) => String(t),
    gridState: { interval: 0, labels: new Map() },
    timeAxisState: { labels: new Map() },
    dt: 16.67,
    targetWindowSecs: 30,
    tooltipY: 14,
    tooltipOutline: true,
    swingMagnitude: 0,
    chartReveal: 1,
    pauseProgress: 0,
    now_ms: 1_700_000_000_000,
    shakeState: createShakeState(),
  }
}

function countOps(trace: TraceEvent[], op: string): number {
  return trace.filter(e => e[0] === op).length
}

describe('drawFrame save/restore count', () => {
  it('uses only non-alpha-only save/restore pairs in steady state', () => {
    const { ctx, trace } = createRecordCtx()
    const visible: LivelinePoint[] = [
      { time: 0, value: 100 },
      { time: 15, value: 150 },
      { time: 30, value: 160 },
    ]
    drawFrame(ctx, fakeLayout(), fakePalette(), fakeOpts(visible))

    const saves = countOps(trace, 'save')
    const restores = countOps(trace, 'restore')

    expect(saves).toBe(restores)
    // After removing alpha-only save/restore wrappers from drawFrame (baseline was 13),
    // the remaining saves are all non-alpha-only: grid per-label, timeAxis per-label,
    // drawLine clip, drawDot shadow, left-edge fade.
    // Baseline 13 → 8 after removing 5 alpha-only index.ts wrappers.
    expect(saves).toBeLessThanOrEqual(8)
  })

  it('balances globalAlpha across the frame', () => {
    const { ctx, trace } = createRecordCtx()
    const visible: LivelinePoint[] = [
      { time: 0, value: 100 },
      { time: 15, value: 150 },
      { time: 30, value: 160 },
    ]
    ctx.globalAlpha = 0.7
    const traceStart = trace.length
    drawFrame(ctx, fakeLayout(), fakePalette(), fakeOpts(visible))
    expect(ctx.globalAlpha).toBeCloseTo(0.7, 5)
    const lastAlphaSet = [...trace.slice(traceStart)].reverse()
      .find(e => e[0] === 'set' && e[1] === 'globalAlpha')
    if (lastAlphaSet) {
      expect(lastAlphaSet[2]).toBeCloseTo(0.7, 5)
    }
  })
})

describe('drawMultiFrame save/restore count', () => {
  it('uses fewer save/restore pairs after refactor', () => {
    const { ctx, trace } = createRecordCtx()
    const palette = fakePalette()
    const opts: MultiSeriesDrawOptions = {
      series: [
        {
          visible: [
            { time: 0, value: 100 },
            { time: 15, value: 150 },
            { time: 30, value: 160 },
          ],
          smoothValue: 160,
          palette,
        },
      ],
      now: 30,
      showGrid: true,
      showPulse: false,
      hoverX: null, hoverTime: null, hoverEntries: [],
      scrubAmount: 0,
      windowSecs: 30,
      formatValue: (v) => v.toFixed(2),
      formatTime: (t) => String(t),
      gridState: { interval: 0, labels: new Map() },
      timeAxisState: { labels: new Map() },
      dt: 16.67,
      targetWindowSecs: 30,
      tooltipY: 14,
      tooltipOutline: true,
      chartReveal: 1,
      pauseProgress: 0,
      now_ms: 1_700_000_000_000,
      primaryPalette: palette,
    }
    drawMultiFrame(ctx, fakeLayout(), opts)

    const saves = countOps(trace, 'save')
    const restores = countOps(trace, 'restore')
    expect(saves).toBe(restores)
    // After removing alpha-only wrappers from drawMultiFrame (referenceLine, grid, timeAxis),
    // the remaining saves are non-alpha-only: per-series line (wraps drawLine which mutates
    // strokeStyle/etc), dot+label block, left-edge fade composite, plus internal sub-function
    // saves (grid per-label, timeAxis per-label, drawLine clip, drawSimpleDot has no save).
    // One extra save vs drawFrame due to the per-series line wrapper.
    expect(saves).toBeLessThanOrEqual(9)
  })
})
