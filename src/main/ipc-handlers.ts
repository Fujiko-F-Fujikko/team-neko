import { BrowserWindow } from 'electron'
import { startActivityMonitor, stopActivityMonitor } from './activity'

export function setupActivityIPC(mainWindow: BrowserWindow): void {
  startActivityMonitor((state, keyCount, clickCount) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('activity:state-changed', {
        state,
        keyPressCount: keyCount,
        mouseClickCount: clickCount
      })
    }
  })
}

export function cleanupActivityIPC(): void {
  stopActivityMonitor()
}
