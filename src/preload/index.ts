import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onActivityChange: (callback: (data: { state: string; keyPressCount: number; mouseClickCount: number }) => void) => {
    ipcRenderer.on('activity:state-changed', (_event, data) => callback(data))
  },
  getServerAddress: (): Promise<string> => ipcRenderer.invoke('get-server-address'),
  toggleOverlay: () => ipcRenderer.send('toggle-overlay'),
  onOverlayModeChanged: (callback: (isOverlay: boolean) => void) => {
    ipcRenderer.on('overlay-mode-changed', (_event, isOverlay) => callback(isOverlay))
  }
})
