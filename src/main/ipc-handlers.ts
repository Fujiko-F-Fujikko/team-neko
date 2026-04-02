import { BrowserWindow, ipcMain } from 'electron'
import { startActivityMonitor, stopActivityMonitor, reportActivity } from './activity'

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

  // Fallback: renderer reports input events when uiohook is not available
  ipcMain.on('activity:report', (_event, type: 'key' | 'click' | 'scroll') => {
    reportActivity(type)
  })
}

export function cleanupActivityIPC(): void {
  stopActivityMonitor()
}
