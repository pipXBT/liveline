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

export interface SplitPaint {
  kind: 'split'
  /** Y-axis value above which the line is painted in `above` color. */
  threshold: number
  /** Color when value >= threshold (the boundary itself counts as above). */
  above: string
  /** Color when value < threshold. */
  below: string
}

export type SegmentPaint = SolidPaint | SplitPaint

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

/** Find the segment whose [from, to) range contains `time`, or null. */
function segmentAt(
  time: number,
  sortedSegments: LineSegment[],
): LineSegment | null {
  for (const seg of sortedSegments) {
    if (seg.from <= time && time < seg.to) return seg
  }
  return null
}

function paintAt(
  time: number,
  value: number,
  sortedSegments: LineSegment[],
  defaultColor: string,
): string {
  const seg = segmentAt(time, sortedSegments)
  if (!seg) return defaultColor
  const paint = seg.paint
  if (paint.kind === 'solid') return paint.color
  return value >= paint.threshold ? paint.above : paint.below
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
        color: paintAt(points[0].time, points[0].value, sortedSegments, defaultColor),
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

  // Walk merged points and emit sub-paths on color transitions.
  //
  // Boundary handling distinguishes four cases:
  //   (a) inSameSplit, prev.value === threshold:
  //       prev IS the boundary. Closing sub-path already ends at prev;
  //       new sub-path starts at [prev, point].
  //   (b) inSameSplit, point.value === threshold:
  //       point IS the boundary. Closing sub-path appends point; new
  //       starts at [point].
  //   (c) inSameSplit, strict crossing:
  //       Interpolate crossing at value=threshold. Closing sub-path
  //       appends crossing; new sub-path starts at [crossing, point].
  //   (e) prev in split, point in different segment, line crosses
  //       threshold within in-split portion:
  //       Three sub-paths emitted in this iteration — closing appends
  //       crossing, intermediate from crossing to point in the OTHER
  //       split-side color, new sub-path starts at [point].
  //   Else (g): time boundary — closing appends point; new starts at [point].
  const subPaths: SubPath[] = []
  let currentColor = paintAt(
    merged[0].time,
    merged[0].value,
    sortedSegments,
    defaultColor,
  )
  let currentPoints: DataPoint[] = [merged[0]]

  for (let i = 1; i < merged.length; i++) {
    const prev = merged[i - 1]
    const point = merged[i]
    const pointColor = paintAt(point.time, point.value, sortedSegments, defaultColor)

    if (pointColor === currentColor) {
      currentPoints.push(point)
      continue
    }

    const prevSeg = segmentAt(prev.time, sortedSegments)
    const pointSeg = segmentAt(point.time, sortedSegments)
    const sameSplit =
      prevSeg !== null && prevSeg === pointSeg && prevSeg.paint.kind === 'split'

    if (sameSplit && prevSeg!.paint.kind === 'split') {
      const split = prevSeg!.paint
      const threshold = split.threshold
      if (prev.value === threshold) {
        // (a) prev IS the boundary.
        subPaths.push({ color: currentColor, points: currentPoints })
        currentPoints = [prev, point]
      } else if (point.value === threshold) {
        // (b) point IS the boundary.
        currentPoints.push(point)
        subPaths.push({ color: currentColor, points: currentPoints })
        currentPoints = [point]
      } else {
        // (c) Strict Y-crossing.
        const span = point.value - prev.value
        const t = prev.time + (threshold - prev.value) * (point.time - prev.time) / span
        const crossing = { time: t, value: threshold }
        currentPoints.push(crossing)
        subPaths.push({ color: currentColor, points: currentPoints })
        currentPoints = [crossing, point]
      }
    } else if (
      prevSeg !== null &&
      prevSeg.paint.kind === 'split' &&
      prevSeg !== pointSeg
    ) {
      // (e) Exit case: prev in split, point in different segment.
      // Check if the line crosses threshold within the in-split portion
      // [prev.time, min(point.time, prevSeg.to)].
      const split = prevSeg.paint
      const threshold = split.threshold
      const inSplitEndTime = Math.min(point.time, prevSeg.to)
      const fraction =
        (inSplitEndTime - prev.time) / (point.time - prev.time)
      const inSplitEndValue = prev.value + (point.value - prev.value) * fraction
      const prevAbove = prev.value >= threshold
      const endAbove = inSplitEndValue >= threshold
      if (
        prevAbove !== endAbove &&
        prev.value !== threshold &&
        inSplitEndValue !== threshold
      ) {
        const span = point.value - prev.value
        const t =
          prev.time + (threshold - prev.value) * (point.time - prev.time) / span
        const crossing = { time: t, value: threshold }
        currentPoints.push(crossing)
        subPaths.push({ color: currentColor, points: currentPoints })
        const intermediateColor = prevAbove ? split.below : split.above
        subPaths.push({
          color: intermediateColor,
          points: [crossing, point],
        })
        currentPoints = [point]
      } else {
        // No Y-crossing inside in-split portion; standard time boundary.
        currentPoints.push(point)
        subPaths.push({ color: currentColor, points: currentPoints })
        currentPoints = [point]
      }
    } else {
      // (g) Standard time boundary — neither side is in the same split.
      currentPoints.push(point)
      subPaths.push({ color: currentColor, points: currentPoints })
      currentPoints = [point]
    }
    currentColor = pointColor
  }

  if (currentPoints.length > 0) {
    subPaths.push({ color: currentColor, points: currentPoints })
  }

  return subPaths
}
