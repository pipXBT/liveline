import { describe, it, expectTypeOf } from 'vitest'
import type { LivelineProps, LivelineFrameState } from '../index'

describe('onFrame public API', () => {
  it('exposes onFrame as an optional callback on LivelineProps', () => {
    expectTypeOf<LivelineProps['onFrame']>().toEqualTypeOf<
      ((state: LivelineFrameState) => void) | undefined
    >()
  })

  it('exposes LivelineFrameState with all documented fields', () => {
    expectTypeOf<LivelineFrameState>().toEqualTypeOf<{
      plotRect: {
        left: number
        right: number
        top: number
        bottom: number
        width: number
        height: number
      }
      leftEdge: number
      rightEdge: number
      windowSecs: number
      yMin: number
      yMax: number
      smoothValue: number
      windowTransProgress: number
      now: number
      now_ms: number
    }>()
  })
})
