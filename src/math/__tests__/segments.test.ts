import { describe, it, expect } from 'vitest'
import { partitionLine, type LineSegment, type SubPath } from '../segments'

// All tests in this file use abstract data points (time, value) — no
// pixel-space mapping. The helper operates entirely in data space; the
// caller is responsible for projecting sub-path points to pixels.

const dp = (time: number, value: number) => ({ time, value })

const solid = (from: number, to: number, color: string): LineSegment => ({
  from,
  to,
  paint: { kind: 'solid', color },
})

const split = (
  from: number,
  to: number,
  threshold: number,
  above: string,
  below: string,
): LineSegment => ({
  from,
  to,
  paint: { kind: 'split', threshold, above, below },
})

// Sub-path equality with float tolerance on time/value, since linear
// interpolation can produce e.g. 220.00000000000003 instead of 220.
function expectSubPaths(actual: SubPath[], expected: SubPath[]) {
  expect(actual.length).toBe(expected.length)
  for (let i = 0; i < actual.length; i++) {
    expect(actual[i].color).toBe(expected[i].color)
    expect(actual[i].points.length).toBe(expected[i].points.length)
    for (let j = 0; j < actual[i].points.length; j++) {
      expect(actual[i].points[j].time).toBeCloseTo(expected[i].points[j].time, 6)
      expect(actual[i].points[j].value).toBeCloseTo(expected[i].points[j].value, 6)
    }
  }
}

describe('partitionLine — solid segments', () => {
  it('returns a single default-colored sub-path when no segments are provided', () => {
    const points = [dp(1, 100), dp(2, 110), dp(3, 105)]
    const result = partitionLine(points, [], '#blue')
    expectSubPaths(result, [{ color: '#blue', points }])
  })

  it('returns an empty array when there are no points', () => {
    const result = partitionLine([], [solid(1, 5, '#red')], '#blue')
    expectSubPaths(result, [])
  })

  it('returns a single sub-path when a single point exists (no line to draw, but stable contract)', () => {
    const result = partitionLine([dp(2, 100)], [], '#blue')
    expectSubPaths(result, [{ color: '#blue', points: [dp(2, 100)] }])
  })

  it('paints the entire line in segment color when a solid segment covers all data', () => {
    const points = [dp(1, 100), dp(2, 110), dp(3, 105)]
    const result = partitionLine(points, [solid(0, 10, '#red')], '#blue')
    expectSubPaths(result, [{ color: '#red', points }])
  })

  it('emits three sub-paths when a solid segment lands inside data with native boundary points', () => {
    // Native points at exactly t=2 and t=4 — the segment boundaries.
    const points = [dp(1, 100), dp(2, 200), dp(3, 300), dp(4, 400), dp(5, 500)]
    const result = partitionLine(points, [solid(2, 4, '#red')], '#blue')

    // Pre: includes the boundary point at t=2 (so the pre stroke ends at the boundary).
    // Segment: also includes the boundary points at t=2 and t=4 (so the colored stroke
    //          starts at the boundary and ends at the next boundary).
    // Post: includes the boundary point at t=4 (so the post stroke starts at the boundary).
    expectSubPaths(result, [
      { color: '#blue', points: [dp(1, 100), dp(2, 200)] },
      { color: '#red', points: [dp(2, 200), dp(3, 300), dp(4, 400)] },
      { color: '#blue', points: [dp(4, 400), dp(5, 500)] },
    ])
  })

  it('interpolates synthetic boundary points when the segment edge lands between native points', () => {
    // Boundaries at t=2.5 and t=4.5; native points at integer times.
    // Linear interp: value at t=2.5 between (2,200) and (3,300) = 250.
    //                value at t=4.5 between (4,400) and (5,500) = 450.
    const points = [dp(1, 100), dp(2, 200), dp(3, 300), dp(4, 400), dp(5, 500)]
    const result = partitionLine(points, [solid(2.5, 4.5, '#red')], '#blue')

    expectSubPaths(result, [
      { color: '#blue', points: [dp(1, 100), dp(2, 200), dp(2.5, 250)] },
      { color: '#red', points: [dp(2.5, 250), dp(3, 300), dp(4, 400), dp(4.5, 450)] },
      { color: '#blue', points: [dp(4.5, 450), dp(5, 500)] },
    ])
  })

  it('handles a segment that starts before the first data point', () => {
    const points = [dp(2, 200), dp(3, 300), dp(4, 400)]
    const result = partitionLine(points, [solid(0, 3.5, '#red')], '#blue')
    // Segment covers from before first point through t=3.5; no synthetic
    // boundary at t=0 (no data to interpolate from).
    expectSubPaths(result, [
      { color: '#red', points: [dp(2, 200), dp(3, 300), dp(3.5, 350)] },
      { color: '#blue', points: [dp(3.5, 350), dp(4, 400)] },
    ])
  })

  it('handles a segment that extends beyond the last data point', () => {
    const points = [dp(2, 200), dp(3, 300), dp(4, 400)]
    const result = partitionLine(points, [solid(2.5, 10, '#red')], '#blue')
    expectSubPaths(result, [
      { color: '#blue', points: [dp(2, 200), dp(2.5, 250)] },
      { color: '#red', points: [dp(2.5, 250), dp(3, 300), dp(4, 400)] },
    ])
  })

  it('produces no sub-path for a segment entirely before the first data point', () => {
    const points = [dp(5, 500), dp(6, 600)]
    const result = partitionLine(points, [solid(1, 3, '#red')], '#blue')
    // Segment never overlaps any data; whole line is default-colored.
    expectSubPaths(result, [{ color: '#blue', points }])
  })

  it('produces no sub-path for a segment entirely after the last data point', () => {
    const points = [dp(1, 100), dp(2, 200)]
    const result = partitionLine(points, [solid(5, 7, '#red')], '#blue')
    expectSubPaths(result, [{ color: '#blue', points }])
  })

  it('handles multiple non-overlapping solid segments', () => {
    const points = [dp(0, 0), dp(1, 100), dp(2, 200), dp(3, 300), dp(4, 400), dp(5, 500)]
    const result = partitionLine(
      points,
      [solid(1, 2, '#red'), solid(3, 4, '#green')],
      '#blue',
    )
    expectSubPaths(result, [
      { color: '#blue', points: [dp(0, 0), dp(1, 100)] },
      { color: '#red', points: [dp(1, 100), dp(2, 200)] },
      { color: '#blue', points: [dp(2, 200), dp(3, 300)] },
      { color: '#green', points: [dp(3, 300), dp(4, 400)] },
      { color: '#blue', points: [dp(4, 400), dp(5, 500)] },
    ])
  })

  it('renders a segment with no native points inside via two synthetic boundary points (placeholder for next test)', () => {
    // Segment from t=2.2 to t=2.8; only native points at t=2 and t=3.
    const points = [dp(1, 100), dp(2, 200), dp(3, 300), dp(4, 400)]
    const result = partitionLine(points, [solid(2.2, 2.8, '#red')], '#blue')
    // Pre: native points up to t=2, then interpolated boundary at t=2.2 (value 220).
    // Segment: just the two interpolated boundaries (220 at t=2.2, 280 at t=2.8).
    // Post: interpolated boundary at t=2.8, then native points from t=3.
    expectSubPaths(result, [
      { color: '#blue', points: [dp(1, 100), dp(2, 200), dp(2.2, 220)] },
      { color: '#red', points: [dp(2.2, 220), dp(2.8, 280)] },
      { color: '#blue', points: [dp(2.8, 280), dp(3, 300), dp(4, 400)] },
    ])
  })
})

describe('partitionLine — split segments', () => {
  it('returns a single above-colored sub-path when all values are above threshold', () => {
    const points = [dp(1, 150), dp(2, 200), dp(3, 175)]
    const result = partitionLine(points, [split(0, 10, 100, '#green', '#red')], '#blue')
    expectSubPaths(result, [{ color: '#green', points }])
  })

  it('returns a single below-colored sub-path when all values are below threshold', () => {
    const points = [dp(1, 50), dp(2, 25), dp(3, 75)]
    const result = partitionLine(points, [split(0, 10, 100, '#green', '#red')], '#blue')
    expectSubPaths(result, [{ color: '#red', points }])
  })

  it('inserts a synthetic crossing point when the line crosses the threshold once (below → above)', () => {
    // Threshold=100; (0,50)→(1,150) crosses at t = 0 + (100-50)/(150-50)*(1-0) = 0.5.
    const points = [dp(0, 50), dp(1, 150)]
    const result = partitionLine(points, [split(0, 10, 100, '#green', '#red')], '#blue')
    expectSubPaths(result, [
      { color: '#red', points: [dp(0, 50), dp(0.5, 100)] },
      { color: '#green', points: [dp(0.5, 100), dp(1, 150)] },
    ])
  })

  it('inserts a synthetic crossing point when the line crosses the threshold once (above → below)', () => {
    // Threshold=100; (0,150)→(1,50) crosses at t = 0 + (100-150)/(50-150)*(1-0) = 0.5.
    const points = [dp(0, 150), dp(1, 50)]
    const result = partitionLine(points, [split(0, 10, 100, '#green', '#red')], '#blue')
    expectSubPaths(result, [
      { color: '#green', points: [dp(0, 150), dp(0.5, 100)] },
      { color: '#red', points: [dp(0.5, 100), dp(1, 50)] },
    ])
  })

  it('handles multiple threshold crossings within a single split segment', () => {
    // Zigzag: 50 → 150 → 50 → 150 across a single split segment.
    const points = [dp(0, 50), dp(1, 150), dp(2, 50), dp(3, 150)]
    const result = partitionLine(points, [split(0, 10, 100, '#green', '#red')], '#blue')
    expectSubPaths(result, [
      { color: '#red', points: [dp(0, 50), dp(0.5, 100)] },
      { color: '#green', points: [dp(0.5, 100), dp(1, 150), dp(1.5, 100)] },
      { color: '#red', points: [dp(1.5, 100), dp(2, 50), dp(2.5, 100)] },
      { color: '#green', points: [dp(2.5, 100), dp(3, 150)] },
    ])
  })

  it('treats values exactly at the threshold as above (>= rule)', () => {
    // (0, 100) is at threshold — counts as above (green).
    // (1, 50) is below (red).
    // No synthetic crossing inserted because the existing point is the boundary.
    const points = [dp(0, 100), dp(1, 50)]
    const result = partitionLine(points, [split(0, 10, 100, '#green', '#red')], '#blue')
    expectSubPaths(result, [
      { color: '#green', points: [dp(0, 100)] },
      { color: '#red', points: [dp(0, 100), dp(1, 50)] },
    ])
  })

  it('combines split and solid segments with default color', () => {
    // Default blue, then split [1, 3] (above=green/below=red), then default blue.
    const points = [dp(0, 80), dp(1, 80), dp(2, 120), dp(3, 80), dp(4, 80)]
    const result = partitionLine(
      points,
      [split(1, 3, 100, '#green', '#red')],
      '#blue',
    )
    // At t=1: synthetic time-boundary at v=80 (below threshold).
    // At t=1.5: synthetic Y-crossing on (1,80)→(2,120) at v=100, t=1+(100-80)/(120-80)*(2-1)=1.5.
    // At t=2.5: synthetic Y-crossing on (2,120)→(3,80) at v=100, t=2+(100-120)/(80-120)*(3-2)=2.5.
    // At t=3: synthetic time-boundary at v=80.
    expectSubPaths(result, [
      { color: '#blue', points: [dp(0, 80), dp(1, 80)] },
      { color: '#red', points: [dp(1, 80), dp(1.5, 100)] },
      { color: '#green', points: [dp(1.5, 100), dp(2, 120), dp(2.5, 100)] },
      { color: '#red', points: [dp(2.5, 100), dp(3, 80)] },
      { color: '#blue', points: [dp(3, 80), dp(4, 80)] },
    ])
  })

  it('does not interpolate Y-crossings when one end of the pair is outside the split segment', () => {
    // Split [1, 2]; native point at (0, 50) is outside, (1, 150) is the time-boundary
    // entering the split at v=150 (above), (2, 50) is the time-boundary exiting at v=50.
    // Inside the split [1,2], values are 150→50 — crosses threshold at t=1.5.
    const points = [dp(0, 50), dp(1, 150), dp(2, 50), dp(3, 50)]
    const result = partitionLine(
      points,
      [split(1, 2, 100, '#green', '#red')],
      '#blue',
    )
    expectSubPaths(result, [
      { color: '#blue', points: [dp(0, 50), dp(1, 150)] },
      { color: '#green', points: [dp(1, 150), dp(1.5, 100)] },
      { color: '#red', points: [dp(1.5, 100), dp(2, 50)] },
      { color: '#blue', points: [dp(2, 50), dp(3, 50)] },
    ])
  })
})
