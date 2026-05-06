import type { CSSProperties } from 'react'
import type { LineSegment } from './math/segments'

export interface LivelinePoint {
  time: number  // unix seconds
  value: number
}

export type Momentum = 'up' | 'down' | 'flat'
export type ThemeMode = 'light' | 'dark'
export type WindowStyle = 'default' | 'rounded' | 'text'
export type BadgeVariant = 'default' | 'minimal'

export interface ReferenceLine {
  value: number
  label?: string
}

export interface HoverPoint {
  time: number
  value: number
  x: number
  y: number
}

export interface Padding {
  top?: number
  right?: number
  bottom?: number
  left?: number
}

export interface WindowOption {
  label: string
  secs: number
}

export interface OrderbookData {
  bids: [number, number][]  // [price, size][]
  asks: [number, number][]  // [price, size][]
}

export interface DegenOptions {
  /** Multiplier for particle count and size (default 1) */
  scale?: number
  /** Show particles on down-momentum swings (default false) */
  downMomentum?: boolean
}

export interface LivelineSeries {
  id: string
  data: LivelinePoint[]
  value: number
  color: string
  label?: string
}

export interface LivelineProps {
  data: LivelinePoint[]
  value: number

  // Multi-series mode — when provided, overrides data/value/color
  series?: LivelineSeries[]

  // Appearance
  theme?: ThemeMode
  color?: string

  // Time
  window?: number

  /**
   * When set, overrides the trailing right edge with a fixed time anchor
   * (unix seconds). Default is undefined, which falls back to the
   * built-in `now + windowSecs * candleBuffer` trailing behavior.
   *
   * Use case: anchor a specific moment (e.g., a round's lock event) at
   * a chosen position within the visible window. With windowSecs=16 and
   * rightEdgeAt set to anchor_time + 8, the anchor sits at the visible
   * window's horizontal center; the left edge becomes anchor_time - 8.
   */
  rightEdgeAt?: number

  /**
   * When true and `referenceLine` is set, the Y-axis is forced
   * symmetric around the reference value: floor and ceiling are
   * equidistant from it, so the reference line sits at the chart's
   * vertical midpoint regardless of which side the data has moved
   * toward. Pairs naturally with `exaggerate` to put a "this is the
   * pivot" price level dead-center during a focused window.
   */
  centerOnReference?: boolean

  // Feature flags
  grid?: boolean
  badge?: boolean
  momentum?: boolean | Momentum
  fill?: boolean
  loading?: boolean         // Show loading animation — breathing line (default: false)
  paused?: boolean          // Pause chart scrolling (default: false)
  emptyText?: string        // Text shown in the empty state (default: 'No data to display')
  scrub?: boolean           // Enable crosshair scrubbing on hover (default: true)
  exaggerate?: boolean      // Tight Y-axis range — small moves fill chart height (default: false)
  showValue?: boolean       // Show live value as DOM text overlay (default: false)
  valueMomentumColor?: boolean // Color the value text by momentum — green/red (default: false)
  degen?: boolean | DegenOptions  // Degen mode — burst particles + chart shake on momentum swings (default: false)
  badgeTail?: boolean       // Show pointed tail on badge pill (default: true)

  // Time window buttons
  windows?: WindowOption[]
  onWindowChange?: (secs: number) => void
  windowStyle?: WindowStyle

  // Badge
  badgeVariant?: BadgeVariant  // Badge visual style: 'default' (accent) or 'minimal' (white + grey text)

  // Crosshair
  tooltipY?: number        // Vertical offset for crosshair tooltip text (default: 14)
  tooltipOutline?: boolean // Stroke outline around crosshair tooltip text for readability (default: true)

  // Orderbook
  orderbook?: OrderbookData

  // Optional
  referenceLine?: ReferenceLine
  formatValue?: (v: number) => string
  formatTime?: (t: number) => string
  lerpSpeed?: number
  padding?: Padding
  onHover?: (point: HoverPoint | null) => void
  cursor?: string          // CSS cursor on hover (default: 'crosshair')
  pulse?: boolean          // Pulsing ring on live dot (default: true)
  lineWidth?: number       // Stroke width of the main line in px (default: 2)

  // Candlestick mode
  mode?: 'line' | 'candle'       // Chart type (default: 'line')
  candles?: CandlePoint[]         // OHLC candle data (required when mode='candle')
  candleWidth?: number            // Seconds per candle (required when mode='candle')
  liveCandle?: CandlePoint        // Current live candle with real-time OHLC
  lineMode?: boolean              // Morph candles into line display
  lineData?: LivelinePoint[]      // Tick-level data for density transition
  lineValue?: number              // Current tick value for density transition
  onModeChange?: (mode: 'line' | 'candle') => void  // Built-in toggle callback
  onSeriesToggle?: (id: string, visible: boolean) => void  // Multi-series toggle callback
  seriesToggleCompact?: boolean  // Show only colored dots (no labels) in series toggle (default: false)

  /**
   * Fires once per RAF draw with the actually-rendered plot state.
   * Use to anchor external annotations (SVG/HTML overlays) to the canvas
   * without re-implementing LiveLine's internal coordinate math.
   *
   * The argument is a single shared object that mutates between calls;
   * read fields synchronously and do not retain the reference.
   */
  onFrame?: (state: LivelineFrameState) => void

  /**
   * Optional time-keyed line color staining. Each segment overrides the
   * line stroke color over its [from, to) time range, either with a solid
   * color or a Y-axis split (above/below a threshold value, optionally
   * with an "equal" band). Time ranges outside any segment fall through
   * to the default `color` prop.
   *
   * Segments are honored only in line mode and only when the chart is
   * not actively scrubbing or in reveal-morph; in those edge cases the
   * line falls back to single-color rendering.
   */
  segments?: LineSegment[]

  /**
   * Render grid + time-axis + reference-line on a separate static canvas
   * that only repaints when those layers actually change (interval shift,
   * window transition, range tween, reveal). The dynamic canvas (line,
   * dot, fill, orderbook, crosshair, badge, particles, fade) keeps its
   * normal RAF cadence.
   *
   * Default: false — static layers paint inline on the dynamic canvas
   * every frame (pre-Task-5 behavior, byte-identical visuals). Opt in
   * for dense-update charts to amortize redundant grid/axis paints.
   *
   * Currently honored in line mode only. Multi-series and candle modes
   * still paint inline (even with the flag set).
   */
  staticLayer?: boolean

  className?: string
  style?: CSSProperties
}

export interface CandlePoint {
  time: number   // unix seconds — candle open time
  open: number
  high: number
  low: number
  close: number
}

export interface LivelinePalette {
  // Line
  line: string
  lineWidth: number

  // Fill gradient
  fillTop: string
  fillBottom: string

  // Grid
  gridLine: string
  gridLabel: string

  // Dot
  dotUp: string
  dotDown: string
  dotFlat: string
  glowUp: string
  glowDown: string
  glowFlat: string

  // Badge
  badgeOuterBg: string
  badgeOuterShadow: string
  badgeBg: string
  badgeText: string

  // Dash line
  dashLine: string

  // Reference line
  refLine: string
  refLabel: string

  // Time axis
  timeLabel: string

  // Crosshair
  crosshairLine: string
  tooltipBg: string
  tooltipText: string
  tooltipBorder: string

  // Background (for color fading — labels fade toward bg instead of alpha)
  bgRgb: [number, number, number]

  // Fonts
  labelFont: string
  valueFont: string
  badgeFont: string
}

export interface ChartLayout {
  w: number
  h: number
  pad: Required<Padding>
  chartW: number
  chartH: number
  leftEdge: number
  rightEdge: number
  minVal: number
  maxVal: number
  valRange: number
  toX: (t: number) => number
  toY: (v: number) => number
}

/**
 * Per-frame snapshot of LiveLine's actually-rendered plot state.
 *
 * Published once per RAF draw via the optional `onFrame` callback on
 * `LivelineProps`. The values are post-tween and post-smoothing —
 * what the canvas painted *this* frame, not the steady-state target.
 *
 * **Object reuse contract:** the same object is passed to every call.
 * Read fields synchronously inside the callback. Do NOT retain the
 * reference; its fields will mutate on the next frame.
 */
export interface LivelineFrameState {
  /** Plot rectangle in CSS pixels, relative to the canvas container. */
  plotRect: {
    left: number
    right: number
    top: number
    bottom: number
    width: number
    height: number
  }
  /** Currently-rendered window edges in unix seconds. */
  leftEdge: number
  rightEdge: number
  /** Currently-rendered window length in seconds (mid-tween if applicable). */
  windowSecs: number
  /** Currently-rendered Y domain — post-`updateRange` smoothing. */
  yMin: number
  yMax: number
  /** Smoothed live value used to position the right-edge tip. */
  smoothValue: number
  /** Window-transition progress; 0 settled, (0..1) mid-tween. */
  windowTransProgress: number
  /** LiveLine's internal clock at draw time. */
  now: number
  now_ms: number
}
