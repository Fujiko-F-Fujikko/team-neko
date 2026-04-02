import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  onActivityChange: (callback: (data: { state: string; keyPressCount: number; mouseClickCount: number }) => void) => {
    ipcRenderer.on('activity:state-changed', (_event, data) => callback(data))
  },
  getServerAddress: (): Promise<string> => ipcRenderer.invoke('get-server-address'),
  reportActivity: (type: 'key' | 'click' | 'scroll') => ipcRenderer.send('activity:report', type),
  toggleOverlay: () => ipcRenderer.send('toggle-overlay'),
  onOverlayModeChanged: (callback: (isOverlay: boolean) => void) => {
    ipcRenderer.on('overlay-mode-changed', (_event, isOverlay) => callback(isOverlay))
  },
  resizeOverlay: (memberCount: number) => ipcRenderer.send('resize-overlay', memberCount),
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) =>
    ipcRenderer.send('set-ignore-mouse-events', ignore, options)
})
