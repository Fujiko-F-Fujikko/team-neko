import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } from 'electron'
import { join } from 'path'
import { setupActivityIPC, cleanupActivityIPC } from './ipc-handlers'
import { startWSServer, stopWSServer, getLocalIP } from './ws-server'

const WS_PORT = 9876

// Disable hardware acceleration for transparent windows
app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let tray: Tray | null = null
let overlayMode = true // Start in overlay mode by default (Bongo Cat style)

function createWindow(): BrowserWindow {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

  // 全画面透過オーバーレイ（各ネコを自由に配置できるよう全画面確保）
  mainWindow = new BrowserWindow({
    width: screenWidth,
    height: screenHeight,
    x: 0,
    y: 0,
    title: 'Team Neko',
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  // 透明領域はクリックスルー、ネコ部分はドラッグ操作を受け付ける
  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Send initial overlay mode state after load
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('overlay-mode-changed', overlayMode)
  })

  return mainWindow
}

function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 600,
    title: 'Team Neko - 設定',
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    resizable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  // Load same URL but with settings hash
  if (process.env.ELECTRON_RENDERER_URL) {
    settingsWindow.loadURL(process.env.ELECTRON_RENDERER_URL + '#settings')
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'settings' })
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

function toggleOverlayMode(): void {
  if (!mainWindow) return

  overlayMode = !overlayMode

  if (overlayMode) {
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
    mainWindow.setAlwaysOnTop(true, 'floating')
    mainWindow.setSkipTaskbar(true)
    mainWindow.setResizable(false)
    mainWindow.setSize(sw, sh)
    mainWindow.setPosition(0, 0)
    mainWindow.setIgnoreMouseEvents(true, { forward: true })
    mainWindow.webContents.send('overlay-mode-changed', true)
  } else {
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setSkipTaskbar(false)
    mainWindow.setResizable(true)
    mainWindow.setIgnoreMouseEvents(false)
    mainWindow.setSize(480, 600)
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
        label: overlayMode ? 'ウィンドウモード' : 'オーバーレイモード',
        click: () => {
          toggleOverlayMode()
          updateMenu()
        }
      },
      {
        label: 'チーム設定...',
        click: () => {
          openSettingsWindow()
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

app.whenReady().then(async () => {
  // Start WebSocket server for team sync (gracefully handles port-in-use)
  await startWSServer()

  // IPC: get server address for renderer
  ipcMain.handle('get-server-address', () => {
    const ip = getLocalIP()
    return `ws://${ip}:${WS_PORT}`
  })

  // IPC: toggle overlay mode from renderer
  ipcMain.on('toggle-overlay', () => {
    toggleOverlayMode()
  })

  // IPC: ドラッグ中のクリックスルー一時切替
  ipcMain.on('set-ignore-mouse-events', (_event, ignore: boolean, options?: { forward: boolean }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIgnoreMouseEvents(ignore, options ?? {})
    }
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
