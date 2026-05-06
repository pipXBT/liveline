if (typeof globalThis.Path2D === 'undefined') {
  class Path2DStub {
    bezierCalls: [number, number, number, number, number, number][] = []
    moveTo() {}
    lineTo() {}
    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
      this.bezierCalls.push([cp1x, cp1y, cp2x, cp2y, x, y])
    }
    closePath() {}
    addPath() {}
  }
  // @ts-expect-error global stub for tests
  globalThis.Path2D = Path2DStub
}

import { describe, it, expect } from 'vitest'
import { drawSpline, splineToPath2D } from '../spline'
import { createRecordCtx } from '../../__tests__/recordCtx'

describe('splineToPath2D', () => {
  it('returns a Path2D instance', () => {
    const path = splineToPath2D([[0, 0], [10, 10], [20, 5]])
    expect(path).toBeInstanceOf(Path2D)
  })

  it('returns an empty Path2D when given <2 points', () => {
    const p = splineToPath2D([[0, 0]])
    expect(p).toBeInstanceOf(Path2D)
  })

  it('emits identical bezier control points to drawSpline for n>=3', () => {
    const pts: [number, number][] = [
      [0, 100], [10, 80], [20, 90], [30, 70],
    ]

    // Capture drawSpline's bezierCurveTo args via recordCtx.
    const a = createRecordCtx()
    a.ctx.moveTo(pts[0][0], pts[0][1])
    drawSpline(a.ctx, pts)
    const drawSplineBeziers = a.trace.filter(e => e[0] === 'bezierCurveTo')

    // splineToPath2D should emit n-1 bezier segments for n points.
    expect(drawSplineBeziers.length).toBe(pts.length - 1)

    // Capture splineToPath2D's bezierCurveTo args via the recording Path2D stub.
    const path = splineToPath2D(pts) as unknown as {
      bezierCalls: [number, number, number, number, number, number][]
    }
    expect(path.bezierCalls.length).toBe(pts.length - 1)

    // Each bezier's 6 control-point args must match drawSpline's output exactly.
    for (let i = 0; i < drawSplineBeziers.length; i++) {
      const [, cp1x, cp1y, cp2x, cp2y, x, y] = drawSplineBeziers[i] as [string, number, number, number, number, number, number]
      const [pCp1x, pCp1y, pCp2x, pCp2y, pX, pY] = path.bezierCalls[i]
      expect(pCp1x).toBeCloseTo(cp1x, 5)
      expect(pCp1y).toBeCloseTo(cp1y, 5)
      expect(pCp2x).toBeCloseTo(cp2x, 5)
      expect(pCp2y).toBeCloseTo(cp2y, 5)
      expect(pX).toBeCloseTo(x, 5)
      expect(pY).toBeCloseTo(y, 5)
    }
  })
})

describe('drawSpline (existing) is preserved', () => {
  it('emits a lineTo when given exactly 2 points', () => {
    const { ctx, trace } = createRecordCtx()
    ctx.moveTo(0, 0)
    drawSpline(ctx, [[0, 0], [10, 10]])
    expect(trace.some(e => e[0] === 'lineTo' && e[1] === 10 && e[2] === 10)).toBe(true)
  })

  it('emits bezierCurveTo segments for n>=3', () => {
    const { ctx, trace } = createRecordCtx()
    ctx.moveTo(0, 0)
    drawSpline(ctx, [[0, 0], [10, 10], [20, 5], [30, 8]])
    const beziers = trace.filter(e => e[0] === 'bezierCurveTo')
    expect(beziers.length).toBe(3)
  })
})
