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
  /** Color when value > threshold + equalRange. */
  above: string
  /** Color when value < threshold - equalRange. */
  below: string
  /**
   * Optional color for the "equal band" |value - threshold| <= equalRange.
   * Both `equal` and `equalRange` must be set to enable the equal band.
   * When unset, the line is split strictly into above (value >= threshold)
   * and below (value < threshold).
   */
  equal?: string
  /** Half-width of the equal band around `threshold`. Default 0 (no band). */
  equalRange?: number
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

type SplitZone = 'above' | 'equal' | 'below'

function splitZone(value: number, paint: SplitPaint): SplitZone {
  const r = paint.equalRange
  if (paint.equal !== undefined && r !== undefined && r > 0) {
    if (Math.abs(value - paint.threshold) <= r) return 'equal'
  }
  return value >= paint.threshold ? 'above' : 'below'
}

function colorForZone(zone: SplitZone, paint: SplitPaint): string {
  if (zone === 'equal' && paint.equal !== undefined) return paint.equal
  return zone === 'above' ? paint.above : paint.below
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
  return colorForZone(splitZone(value, paint), paint)
}

/** Ordered list of value-axis crossings to traverse when going from
 *  `prevZone` to `pointZone` within a split segment. */
function crossingValuesForZoneTransition(
  prevZone: SplitZone,
  pointZone: SplitZone,
  paint: SplitPaint,
): number[] {
  const r = paint.equalRange ?? 0
  const tPlus = paint.threshold + r
  const tMinus = paint.threshold - r
  if (prevZone === pointZone) return []
  if (prevZone === 'above' && pointZone === 'equal') return [tPlus]
  if (prevZone === 'above' && pointZone === 'below') return [tPlus, tMinus]
  if (prevZone === 'equal' && pointZone === 'above') return [tPlus]
  if (prevZone === 'equal' && pointZone === 'below') return [tMinus]
  if (prevZone === 'below' && pointZone === 'equal') return [tMinus]
  if (prevZone === 'below' && pointZone === 'above') return [tMinus, tPlus]
  return []
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
  // Three structural cases:
  //   sameSplit:  prev and point in the same split segment. Uses the
  //               zone-transition helper, which handles 1, 2, or more
  //               zone boundaries (above ↔ equal ↔ below) between them.
  //   exit:       prev in a split segment, point not (different segment
  //               or none). Compute a virtual endpoint at the segment's
  //               exit time, run the zone-transition helper for the
  //               in-split portion, then time-boundary into the next
  //               segment's paint.
  //   default:    time boundary — closing appends point, new starts
  //               at [point].
  const subPaths: SubPath[] = []
  let currentColor = paintAt(
    merged[0].time,
    merged[0].value,
    sortedSegments,
    defaultColor,
  )
  let currentPoints: DataPoint[] = [merged[0]]

  const TIME_EPS = 1e-9
  const sameTime = (a: DataPoint, b: DataPoint) =>
    Math.abs(a.time - b.time) < TIME_EPS

  /** Apply a sequence of zone-transitions between `prev` and `endPoint`,
   *  updating `currentPoints`/`currentColor` and emitting sub-paths.
   *  Returns the value of `currentPoints[-1]` at the end. */
  function applyZoneTransitions(
    prev: DataPoint,
    endPoint: DataPoint,
    split: SplitPaint,
  ): void {
    const transitions = computeZoneTransitions(prev, endPoint, split)
    for (const trans of transitions) {
      const c = trans.crossing
      if (sameTime(c, prev)) {
        // Crossing collapses to prev. cp already ends at prev.
        subPaths.push({ color: currentColor, points: currentPoints })
        currentPoints = [{ ...prev }]
      } else if (sameTime(c, endPoint)) {
        // Crossing collapses to endPoint.
        currentPoints.push({ ...endPoint })
        subPaths.push({ color: currentColor, points: currentPoints })
        currentPoints = [{ ...endPoint }]
      } else {
        currentPoints.push(c)
        subPaths.push({ color: currentColor, points: currentPoints })
        currentPoints = [c]
      }
      currentColor = trans.postColor
    }
  }

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
      applyZoneTransitions(prev, point, split)
      // Append point if not already last (it isn't when crossings are non-collapsing).
      const last = currentPoints[currentPoints.length - 1]
      if (!last || !sameTime(last, point)) {
        currentPoints.push(point)
      }
    } else if (
      prevSeg !== null &&
      prevSeg.paint.kind === 'split' &&
      prevSeg !== pointSeg
    ) {
      // Exit case. Build a virtual endpoint at the segment's exit time
      // and run zone transitions over the in-split portion.
      const split = prevSeg.paint
      const inSplitEndTime = Math.min(point.time, prevSeg.to)
      const fraction =
        (inSplitEndTime - prev.time) / (point.time - prev.time)
      const inSplitEndValue =
        prev.value + (point.value - prev.value) * fraction
      const virtualEnd: DataPoint = {
        time: inSplitEndTime,
        value: inSplitEndValue,
      }
      applyZoneTransitions(prev, virtualEnd, split)
      // Append virtualEnd if not already last (it isn't when no crossings collapsed to it).
      const last = currentPoints[currentPoints.length - 1]
      if (!last || !sameTime(last, virtualEnd)) {
        currentPoints.push(virtualEnd)
      }
      // Close the in-split sub-path.
      subPaths.push({ color: currentColor, points: currentPoints })
      // Start out-of-split sub-path. If virtualEnd === point, we're at the time
      // boundary AT point — start with [point]. Otherwise the line continues
      // past virtualEnd to point, so start with [virtualEnd, point].
      if (sameTime(virtualEnd, point)) {
        currentPoints = [{ ...point }]
      } else {
        currentPoints = [virtualEnd, point]
      }
      currentColor = pointColor
    } else {
      // Default time boundary.
      currentPoints.push(point)
      subPaths.push({ color: currentColor, points: currentPoints })
      currentPoints = [point]
      currentColor = pointColor
    }
  }

  if (currentPoints.length > 0) {
    subPaths.push({ color: currentColor, points: currentPoints })
  }

  return subPaths
}

/** Compute the ordered list of zone-boundary crossings to traverse from
 *  `prev` to `point` within a split segment. */
function computeZoneTransitions(
  prev: DataPoint,
  point: DataPoint,
  split: SplitPaint,
): Array<{ crossing: DataPoint; postColor: string }> {
  const prevZone = splitZone(prev.value, split)
  const pointZone = splitZone(point.value, split)
  if (prevZone === pointZone) return []

  const hasEqual =
    split.equal !== undefined && (split.equalRange ?? 0) > 0
  const r = split.equalRange ?? 0
  const tPlus = split.threshold + r
  const tMinus = split.threshold - r

  const breaks: Array<{ value: number; postZone: SplitZone }> = []
  if (!hasEqual) {
    // Single boundary at threshold (no equal band).
    breaks.push({ value: split.threshold, postZone: pointZone })
  } else if (prevZone === 'above') {
    if (pointZone === 'equal') breaks.push({ value: tPlus, postZone: 'equal' })
    else if (pointZone === 'below') {
      breaks.push({ value: tPlus, postZone: 'equal' })
      breaks.push({ value: tMinus, postZone: 'below' })
    }
  } else if (prevZone === 'equal') {
    if (pointZone === 'above') breaks.push({ value: tPlus, postZone: 'above' })
    else if (pointZone === 'below') breaks.push({ value: tMinus, postZone: 'below' })
  } else {
    // 'below'
    if (pointZone === 'equal') breaks.push({ value: tMinus, postZone: 'equal' })
    else if (pointZone === 'above') {
      breaks.push({ value: tMinus, postZone: 'equal' })
      breaks.push({ value: tPlus, postZone: 'above' })
    }
  }

  const span = point.value - prev.value
  const tSpan = point.time - prev.time
  return breaks.map((brk) => {
    const t =
      span === 0
        ? prev.time
        : prev.time + ((brk.value - prev.value) * tSpan) / span
    return {
      crossing: { time: t, value: brk.value },
      postColor: colorForZone(brk.postZone, split),
    }
  })
}
