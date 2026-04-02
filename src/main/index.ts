import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } from 'electron'
import { join } from 'path'
import { setupActivityIPC, cleanupActivityIPC } from './ipc-handlers'
import { startWSServer, stopWSServer, getLocalIP } from './ws-server'

const WS_PORT = 9876

// Disable hardware acceleration for transparent windows
app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let overlayMode = false

function createWindow(): BrowserWindow {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 480,
    height: 600,
    x: screenWidth - 500,
    y: screenHeight - 620,
    title: 'Team Neko',
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

function toggleOverlayMode(): void {
  if (!mainWindow) return

  overlayMode = !overlayMode

  if (overlayMode) {
    // Switch to overlay mode
    mainWindow.setAlwaysOnTop(true, 'floating')
    mainWindow.setSkipTaskbar(true)
    mainWindow.setIgnoreMouseEvents(true, { forward: true })
    mainWindow.webContents.send('overlay-mode-changed', true)
  } else {
    // Switch to normal mode
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setSkipTaskbar(false)
    mainWindow.setIgnoreMouseEvents(false)
    mainWindow.webContents.send('overlay-mode-changed', false)
  }
}

function createTray(): void {
  // Create a simple 16x16 cat icon using nativeImage
  const iconDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA3klEQVQ4T6WTwQ3CMAxF/0cwAWyAGIENYATYgBFgA9gANmADNgA2gA0YASagJ/lSKiVNqRSpUuLv5/+2E6FnRD31ow+AXYpItwCMmXmf1iDiHYAjgAsz3yXrJQDHCUBEawB7AEdmvqh0tQYiWgI4AZgzcyWJqABwBuCKmcn1EngW0RbAAcDcpU9E20IB4AzAjJnpswYi2gE4ApjlMRDRBsCJmc9p6SL6EJEvU8vTtAdgKaKpB7Bh5nuRxP+FwMx1CSJ6pnXOzNd3AnkNaQ2Fa/DdMwDnM/EI/gC8YYIRUKEjJQAAAABJRU5ErkJggg=='
  const icon = nativeImage.createFromDataURL(iconDataURL)

  tray = new Tray(icon)
  tray.setToolTip('Team Neko')

  const updateMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Team Neko',
        enabled: false
      },
      { type: 'separator' },
      {
        label: overlayMode ? 'ノーマルモード' : 'オーバーレイモード',
        click: () => {
          toggleOverlayMode()
          updateMenu()
        }
      },
      {
        label: '常に最前面',
        type: 'checkbox',
        checked: mainWindow?.isAlwaysOnTop() ?? false,
        click: (item) => {
          mainWindow?.setAlwaysOnTop(item.checked)
        }
      },
      { type: 'separator' },
      {
        label: '表示/非表示',
        click: () => {
          if (mainWindow?.isVisible()) {
            mainWindow.hide()
          } else {
            mainWindow?.show()
          }
        }
      },
      {
        label: '終了',
        click: () => {
          app.quit()
        }
      }
    ])
    tray?.setContextMenu(contextMenu)
  }

  updateMenu()

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.focus()
    } else {
      mainWindow?.show()
    }
  })
}

app.whenReady().then(() => {
  // Start WebSocket server for team sync
  startWSServer()

  // IPC: get server address for renderer
  ipcMain.handle('get-server-address', () => {
    const ip = getLocalIP()
    return `ws://${ip}:${WS_PORT}`
  })

  // IPC: toggle overlay mode from renderer
  ipcMain.on('toggle-overlay', () => {
    toggleOverlayMode()
  })

  const win = createWindow()
  setupActivityIPC(win)
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createWindow()
      setupActivityIPC(win)
    }
  })
})

app.on('before-quit', () => {
  cleanupActivityIPC()
  stopWSServer()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
