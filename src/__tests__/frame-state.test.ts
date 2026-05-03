import { describe, it, expect, vi } from 'vitest'
import { createFrameStatePublisher } from '../frame-state'
import type { ChartLayout, LivelineFrameState } from '../types'

function fakeLayout(over: Partial<ChartLayout> = {}): ChartLayout {
  return {
    w: 500,
    h: 300,
    pad: { top: 5, right: 50, bottom: 20, left: 8 },
    chartW: 442,
    chartH: 275,
    leftEdge: 1000,
    rightEdge: 1060,
    minVal: 100,
    maxVal: 200,
    valRange: 100,
    toX: (t: number) => t,
    toY: (v: number) => v,
    ...over,
  }
}

const baseInputs = {
  displayWindow: 60,
  displayMin: 100,
  displayMax: 200,
  smoothValue: 150,
  windowTransProgress: 0,
  now: 1000,
  now_ms: 1_700_000_000_000,
}

describe('createFrameStatePublisher', () => {
  it('is a no-op when onFrame is undefined', () => {
    const publish = createFrameStatePublisher()
    expect(() =>
      publish(undefined, { layout: fakeLayout(), ...baseInputs }),
    ).not.toThrow()
  })

  it('invokes onFrame once per call', () => {
    const onFrame = vi.fn()
    const publish = createFrameStatePublisher()
    publish(onFrame, { layout: fakeLayout(), ...baseInputs })
    publish(onFrame, { layout: fakeLayout(), ...baseInputs, now: 1001 })
    expect(onFrame).toHaveBeenCalledTimes(2)
  })

  it('publishes a frame state matching the layout and inputs', () => {
    let received: LivelineFrameState | null = null
    const publish = createFrameStatePublisher()
    publish(
      (s) => {
        received = s
      },
      {
        layout: fakeLayout(),
        displayWindow: 60,
        displayMin: 100,
        displayMax: 200,
        smoothValue: 150,
        windowTransProgress: 0.42,
        now: 1234,
        now_ms: 1_234_567_890,
      },
    )
    expect(received).not.toBeNull()
    expect(received).toMatchObject({
      plotRect: { left: 8, right: 450, top: 5, bottom: 280, width: 442, height: 275 },
      leftEdge: 1000,
      rightEdge: 1060,
      windowSecs: 60,
      yMin: 100,
      yMax: 200,
      smoothValue: 150,
      windowTransProgress: 0.42,
      now: 1234,
      now_ms: 1_234_567_890,
    })
  })

  it('reuses the same outer state object across calls', () => {
    const refs: LivelineFrameState[] = []
    const publish = createFrameStatePublisher()
    publish(
      (s) => refs.push(s),
      { layout: fakeLayout(), ...baseInputs },
    )
    publish(
      (s) => refs.push(s),
      { layout: fakeLayout(), ...baseInputs, displayMin: 110, smoothValue: 155 },
    )
    expect(refs[0]).toBe(refs[1])
    // Mutated in place — second call reflects new inputs
    expect(refs[1].yMin).toBe(110)
    expect(refs[1].smoothValue).toBe(155)
  })

  it('reuses the same plotRect object across calls', () => {
    const rects: LivelineFrameState['plotRect'][] = []
    const publish = createFrameStatePublisher()
    publish(
      (s) => rects.push(s.plotRect),
      { layout: fakeLayout(), ...baseInputs },
    )
    publish(
      (s) => rects.push(s.plotRect),
      { layout: fakeLayout({ w: 900, chartW: 842 }), ...baseInputs },
    )
    expect(rects[0]).toBe(rects[1])
    expect(rects[1].right).toBe(850) // 900 - pad.right (50)
    expect(rects[1].width).toBe(842)
  })

  it('two publishers do not share state', () => {
    const a: LivelineFrameState[] = []
    const b: LivelineFrameState[] = []
    const pubA = createFrameStatePublisher()
    const pubB = createFrameStatePublisher()
    pubA((s) => a.push(s), { layout: fakeLayout(), ...baseInputs })
    pubB((s) => b.push(s), { layout: fakeLayout(), ...baseInputs })
    expect(a[0]).not.toBe(b[0])
  })
})
