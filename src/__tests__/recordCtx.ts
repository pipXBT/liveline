export type TraceEvent =
  | [string]
  | [string, ...unknown[]]

export interface RecordedCtx {
  ctx: CanvasRenderingContext2D
  trace: TraceEvent[]
  reset: () => void
}

const METHOD_NAMES = [
  'beginPath', 'moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo',
  'closePath', 'stroke', 'fill', 'fillRect', 'clearRect', 'rect',
  'clip', 'save', 'restore', 'translate', 'scale', 'rotate',
  'setLineDash', 'arc', 'arcTo', 'fillText', 'strokeText',
] as const

const PROPS_TRACKED = [
  'globalAlpha', 'strokeStyle', 'fillStyle', 'lineWidth',
  'lineJoin', 'lineCap', 'globalCompositeOperation',
  'font', 'textAlign', 'textBaseline',
] as const

interface FakeGradient {
  addColorStop: (offset: number, color: string) => void
}

export function createRecordCtx(): RecordedCtx {
  const trace: TraceEvent[] = []
  const stack: Record<string, unknown>[] = []
  const state: Record<string, unknown> = {
    globalAlpha: 1,
    strokeStyle: '#000',
    fillStyle: '#000',
    lineWidth: 1,
    lineJoin: 'miter',
    lineCap: 'butt',
    globalCompositeOperation: 'source-over',
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  }

  const ctx = {} as Record<string, unknown>

  for (const name of METHOD_NAMES) {
    if (name === 'save') {
      ctx[name] = () => {
        stack.push({ ...state })
        trace.push(['save'])
      }
    } else if (name === 'restore') {
      ctx[name] = () => {
        const top = stack.pop()
        if (top) Object.assign(state, top)
        trace.push(['restore'])
      }
    } else {
      ctx[name] = (...args: unknown[]) => {
        trace.push([name, ...args])
      }
    }
  }

  ctx.measureText = (text: string) => ({ width: text.length * 6 })
  ctx.createLinearGradient = (_x0: number, _y0: number, _x1: number, _y1: number): FakeGradient => ({
    addColorStop: () => {},
  })

  for (const prop of PROPS_TRACKED) {
    Object.defineProperty(ctx, prop, {
      get: () => state[prop],
      set: (v: unknown) => {
        state[prop] = v
        trace.push(['set', prop, v])
      },
      enumerable: true,
    })
  }

  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    trace,
    reset: () => {
      trace.length = 0
      stack.length = 0
    },
  }
}
