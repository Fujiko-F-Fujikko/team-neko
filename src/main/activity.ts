import { CatState } from './types'

export type { CatState }

const TYPING_TIMEOUT = 2000
const CLICKING_TIMEOUT = 2000
const SCROLLING_TIMEOUT = 2000
const IDLE_TIMEOUT = 30000

let lastKeyTime = 0
let lastClickTime = 0
let lastScrollTime = 0
let lastAnyInputTime = Date.now()
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

  // Try uiohook-napi for global input detection
  try {
    const { uIOhook } = require('uiohook-napi')

    uIOhook.on('keydown', () => {
      lastKeyTime = Date.now()
      lastAnyInputTime = lastKeyTime
      keyPressCount++
      updateState()
    })

    uIOhook.on('mousedown', () => {
      lastClickTime = Date.now()
      lastAnyInputTime = lastClickTime
      mouseClickCount++
      updateState()
    })

    uIOhook.on('wheel', () => {
      lastScrollTime = Date.now()
      lastAnyInputTime = lastScrollTime
      updateState()
    })

    uIOhook.start()
    console.log('[Team Neko] uiohook-napi started successfully (global input detection)')
  } catch (err) {
    console.warn('[Team Neko] uiohook-napi failed to start, using fallback:', (err as Error).message)
    console.warn('[Team Neko] Renderer-side input detection will be used instead')
  }

  // Periodically check for idle/sleeping transitions
  setInterval(updateState, 1000)
}

// Called from renderer via IPC when uiohook is not available
export function reportActivity(type: 'key' | 'click' | 'scroll'): void {
  const now = Date.now()
  lastAnyInputTime = now
  if (type === 'key') {
    lastKeyTime = now
    keyPressCount++
  } else if (type === 'click') {
    lastClickTime = now
    mouseClickCount++
  } else if (type === 'scroll') {
    lastScrollTime = now
  }
  updateState()
}

export function stopActivityMonitor(): void {
  try {
    const { uIOhook } = require('uiohook-napi')
    uIOhook.stop()
  } catch {
    // uiohook was never started
  }
}
