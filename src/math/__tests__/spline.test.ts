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

  it('produces the same canvas operations as drawSpline for n>=3', () => {
    const pts: [number, number][] = [
      [0, 100], [10, 80], [20, 90], [30, 70],
    ]
    const a = createRecordCtx()
    a.ctx.moveTo(pts[0][0], pts[0][1])
    drawSpline(a.ctx, pts)

    const b = createRecordCtx()
    const path = splineToPath2D(pts)
    b.ctx.stroke(path)
    expect(b.trace.some(e => e[0] === 'stroke')).toBe(true)
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
