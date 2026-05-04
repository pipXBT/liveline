// Time-based line color staining. Pure data-space helper — operates on
// (time, value) points and produces color-tagged sub-paths. Pixel
// projection is the caller's responsibility.

export interface DataPoint {
  time: number
  value: number
}

export interface SolidPaint {
  kind: 'solid'
  color: string
}

export type SegmentPaint = SolidPaint

export interface LineSegment {
  /** Inclusive lower bound on time (unix seconds). */
  from: number
  /** Exclusive upper bound on time (unix seconds). */
  to: number
  paint: SegmentPaint
}

export interface SubPath {
  color: string
  points: DataPoint[]
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function interpolate(p0: DataPoint, p1: DataPoint, time: number): DataPoint {
  const span = p1.time - p0.time
  if (span === 0) return { time, value: p0.value }
  const t = (time - p0.time) / span
  return { time, value: lerp(p0.value, p1.value, t) }
}

/** Linearly interpolate the value at `time` if it falls strictly between
 *  two adjacent points; null otherwise. */
function getValueAt(points: DataPoint[], time: number): number | null {
  if (points.length < 2) return null
  if (time <= points[0].time) return null
  if (time >= points[points.length - 1].time) return null
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].time <= time && time <= points[i + 1].time) {
      return interpolate(points[i], points[i + 1], time).value
    }
  }
  return null
}

function colorAt(
  time: number,
  sortedSegments: LineSegment[],
  defaultColor: string,
): string {
  for (const seg of sortedSegments) {
    if (seg.from <= time && time < seg.to) return seg.paint.color
  }
  return defaultColor
}

/**
 * Split a polyline into per-color sub-paths according to time-keyed
 * `LineSegment`s. Each segment paints the line in its color over
 * `[from, to)`; gaps between segments use `defaultColor`.
 *
 * Synthetic boundary points are linearly interpolated where a segment
 * edge falls between two native data points so color transitions land
 * on the exact pixel of the boundary, not on the next-after tick.
 *
 * Adjacent sub-paths share their boundary point, so consecutive
 * strokes meet seamlessly with hard color cuts.
 */
export function partitionLine(
  points: DataPoint[],
  segments: LineSegment[],
  defaultColor: string,
): SubPath[] {
  if (points.length === 0) return []

  // Drop degenerate segments (from >= to). Sort by from for stable iteration.
  const sortedSegments = segments
    .filter((s) => s.from < s.to)
    .slice()
    .sort((a, b) => a.from - b.from)

  if (points.length === 1) {
    return [
      {
        color: colorAt(points[0].time, sortedSegments, defaultColor),
        points: [{ ...points[0] }],
      },
    ]
  }

  const dataMin = points[0].time
  const dataMax = points[points.length - 1].time

  // Collect boundary times that fall strictly inside the data range.
  // Boundaries equal to or outside the data ends never need synthetic
  // points: at the ends, native points already exist; outside the data,
  // there's nothing to interpolate from.
  const boundaryTimes = new Set<number>()
  for (const seg of sortedSegments) {
    if (seg.from > dataMin && seg.from < dataMax) boundaryTimes.add(seg.from)
    if (seg.to > dataMin && seg.to < dataMax) boundaryTimes.add(seg.to)
  }

  // Merge native and synthetic points into a sorted timeline.
  const nativeTimes = new Set(points.map((p) => p.time))
  const merged: DataPoint[] = points.map((p) => ({ ...p }))
  for (const b of boundaryTimes) {
    if (nativeTimes.has(b)) continue
    const v = getValueAt(points, b)
    if (v === null) continue
    merged.push({ time: b, value: v })
  }
  merged.sort((a, b) => a.time - b.time)

  // Walk through, opening a new sub-path each time the color changes.
  // Adjacent sub-paths share the boundary point so strokes meet seamlessly.
  const subPaths: SubPath[] = []
  let currentColor = colorAt(merged[0].time, sortedSegments, defaultColor)
  let currentPoints: DataPoint[] = [merged[0]]

  for (let i = 1; i < merged.length; i++) {
    const point = merged[i]
    const pointColor = colorAt(point.time, sortedSegments, defaultColor)
    if (pointColor !== currentColor) {
      currentPoints.push(point)
      subPaths.push({ color: currentColor, points: currentPoints })
      currentPoints = [point]
      currentColor = pointColor
    } else {
      currentPoints.push(point)
    }
  }

  if (currentPoints.length > 0) {
    subPaths.push({ color: currentColor, points: currentPoints })
  }

  return subPaths
}
