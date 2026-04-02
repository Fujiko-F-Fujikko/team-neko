import { uIOhook, UiohookKeyboardEvent, UiohookMouseEvent, UiohookWheelEvent } from 'uiohook-napi'
import { CatState } from './types'

export type { CatState }

const TYPING_TIMEOUT = 2000
const CLICKING_TIMEOUT = 2000
const SCROLLING_TIMEOUT = 2000
const IDLE_TIMEOUT = 30000

let lastKeyTime = 0
let lastClickTime = 0
let lastScrollTime = 0
let lastAnyInputTime = 0
let keyPressCount = 0
let mouseClickCount = 0

let currentState: CatState = 'idle'
let stateChangeCallback: ((state: CatState, keyCount: number, clickCount: number) => void) | null = null

// Reset rolling counts every 10 seconds
setInterval(() => {
  keyPressCount = 0
  mouseClickCount = 0
}, 10000)

function computeState(): CatState {
  const now = Date.now()
  const timeSinceKey = now - lastKeyTime
  const timeSinceClick = now - lastClickTime
  const timeSinceScroll = now - lastScrollTime
  const timeSinceAny = now - lastAnyInputTime

  if (timeSinceKey < TYPING_TIMEOUT) return 'typing'
  if (timeSinceClick < CLICKING_TIMEOUT) return 'clicking'
  if (timeSinceScroll < SCROLLING_TIMEOUT) return 'scrolling'
  if (timeSinceAny > IDLE_TIMEOUT) return 'sleeping'
  return 'idle'
}

function updateState(): void {
  const newState = computeState()
  if (newState !== currentState) {
    currentState = newState
    stateChangeCallback?.(currentState, keyPressCount, mouseClickCount)
  }
}

export function startActivityMonitor(
  onChange: (state: CatState, keyCount: number, clickCount: number) => void
): void {
  stateChangeCallback = onChange

  uIOhook.on('keydown', (_e: UiohookKeyboardEvent) => {
    lastKeyTime = Date.now()
    lastAnyInputTime = lastKeyTime
    keyPressCount++
    updateState()
  })

  uIOhook.on('mousedown', (_e: UiohookMouseEvent) => {
    lastClickTime = Date.now()
    lastAnyInputTime = lastClickTime
    mouseClickCount++
    updateState()
  })

  uIOhook.on('wheel', (_e: UiohookWheelEvent) => {
    lastScrollTime = Date.now()
    lastAnyInputTime = lastScrollTime
    updateState()
  })

  // Periodically check for idle/sleeping transitions
  setInterval(updateState, 1000)

  uIOhook.start()
}

export function stopActivityMonitor(): void {
  uIOhook.stop()
}
