import { useState, useEffect } from 'react'
import { CatState } from '../types'

interface ElectronAPI {
  onActivityChange: (callback: (data: { state: CatState; keyPressCount: number; mouseClickCount: number }) => void) => void
  getServerAddress: () => Promise<string>
  toggleOverlay: () => void
  onOverlayModeChanged: (callback: (isOverlay: boolean) => void) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export function useActivity() {
  const [state, setState] = useState<CatState>('idle')
  const [keyPressCount, setKeyPressCount] = useState(0)
  const [mouseClickCount, setMouseClickCount] = useState(0)

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onActivityChange((data) => {
        setState(data.state)
        setKeyPressCount(data.keyPressCount)
        setMouseClickCount(data.mouseClickCount)
      })
    }
  }, [])

  return { state, keyPressCount, mouseClickCount }
}
