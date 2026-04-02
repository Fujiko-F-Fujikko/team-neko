import { useState, useEffect, useRef, useCallback } from 'react'
import { CatState } from '../types'

interface ElectronAPI {
  onActivityChange: (callback: (data: { state: CatState; keyPressCount: number; mouseClickCount: number }) => void) => void
  getServerAddress: () => Promise<string>
  reportActivity: (type: 'key' | 'click' | 'scroll') => void
  toggleOverlay: () => void
  onOverlayModeChanged: (callback: (isOverlay: boolean) => void) => void
  resizeOverlay: (memberCount: number) => void
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

const TYPING_TIMEOUT = 2000
const CLICKING_TIMEOUT = 2000
const SCROLLING_TIMEOUT = 2000
const IDLE_TIMEOUT = 30000

function computeState(lastKey: number, lastClick: number, lastScroll: number, lastAny: number): CatState {
  const now = Date.now()
  if (now - lastKey < TYPING_TIMEOUT) return 'typing'
  if (now - lastClick < CLICKING_TIMEOUT) return 'clicking'
  if (now - lastScroll < SCROLLING_TIMEOUT) return 'scrolling'
  if (now - lastAny > IDLE_TIMEOUT) return 'sleeping'
  return 'idle'
}

export function useActivity() {
  const [state, setState] = useState<CatState>('idle')
  const [keyPressCount, setKeyPressCount] = useState(0)
  const [mouseClickCount, setMouseClickCount] = useState(0)

  // Use refs to track timestamps without re-renders
  const lastKey = useRef(0)
  const lastClick = useRef(0)
  const lastScroll = useRef(0)
  const lastAny = useRef(Date.now())
  const localKeys = useRef(0)
  const localClicks = useRef(0)
  const usingIPC = useRef(false)

  const refresh = useCallback(() => {
    if (usingIPC.current) return
    const s = computeState(lastKey.current, lastClick.current, lastScroll.current, lastAny.current)
    setState(s)
    setKeyPressCount(localKeys.current)
    setMouseClickCount(localClicks.current)
  }, [])

  useEffect(() => {
    // IPC from Electron main process (uiohook-napi)
    if (window.electronAPI) {
      window.electronAPI.onActivityChange((data) => {
        usingIPC.current = true
        setState(data.state)
        setKeyPressCount(data.keyPressCount)
        setMouseClickCount(data.mouseClickCount)
      })
    }

    // Document-level input detection (works in browser + Electron fallback)
    const onKey = () => {
      const now = Date.now()
      lastKey.current = now
      lastAny.current = now
      localKeys.current++
      window.electronAPI?.reportActivity('key')
      refresh()
    }

    const onClick = () => {
      const now = Date.now()
      lastClick.current = now
      lastAny.current = now
      localClicks.current++
      window.electronAPI?.reportActivity('click')
      refresh()
    }

    const onScroll = () => {
      const now = Date.now()
      lastScroll.current = now
      lastAny.current = now
      window.electronAPI?.reportActivity('scroll')
      refresh()
    }

    window.addEventListener('keydown', onKey, true)
    window.addEventListener('mousedown', onClick, true)
    window.addEventListener('wheel', onScroll, true)

    // Periodic check for idle/sleep
    const timer = setInterval(refresh, 1000)

    // Reset counts every 10s
    const resetTimer = setInterval(() => {
      localKeys.current = 0
      localClicks.current = 0
    }, 10000)

    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('mousedown', onClick, true)
      window.removeEventListener('wheel', onScroll, true)
      clearInterval(timer)
      clearInterval(resetTimer)
    }
  }, [refresh])

  return { state, keyPressCount, mouseClickCount }
}
