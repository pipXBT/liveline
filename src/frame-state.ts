import type { ChartLayout, LivelineFrameState } from './types'

export interface FrameStateInputs {
  layout: ChartLayout
  displayWindow: number
  displayMin: number
  displayMax: number
  smoothValue: number
  windowTransProgress: number
  now: number
  now_ms: number
}

export type FrameStatePublisher = (
  onFrame: ((state: LivelineFrameState) => void) | undefined,
  inputs: FrameStateInputs,
) => void

export function createFrameStatePublisher(): FrameStatePublisher {
  const state: LivelineFrameState = {
    plotRect: { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 },
    leftEdge: 0,
    rightEdge: 0,
    windowSecs: 0,
    yMin: 0,
    yMax: 0,
    smoothValue: 0,
    windowTransProgress: 0,
    now: 0,
    now_ms: 0,
  }
  return (onFrame, inputs) => {
    if (!onFrame) return
    const { layout } = inputs
    state.plotRect.left = layout.pad.left
    state.plotRect.right = layout.w - layout.pad.right
    state.plotRect.top = layout.pad.top
    state.plotRect.bottom = layout.h - layout.pad.bottom
    state.plotRect.width = layout.chartW
    state.plotRect.height = layout.chartH
    state.leftEdge = layout.leftEdge
    state.rightEdge = layout.rightEdge
    state.windowSecs = inputs.displayWindow
    state.yMin = inputs.displayMin
    state.yMax = inputs.displayMax
    state.smoothValue = inputs.smoothValue
    state.windowTransProgress = inputs.windowTransProgress
    state.now = inputs.now
    state.now_ms = inputs.now_ms
    onFrame(state)
  }
}
