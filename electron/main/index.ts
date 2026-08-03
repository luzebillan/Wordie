import { app, BrowserWindow, shell, ipcMain, protocol, net } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { update } from './update'
import { dbHandlers, initDB } from './db'
import { aiGenerateExpression, aiGenerateGlossary, aiGenerateDailyWord, aiGenerateReadyVersion, aiRewritePractice } from './ai'
import { downloadImage, uploadLocalImage, getImagesDir } from './imageCache'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (process.platform === 'win32' && os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'Main window',
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
    frame: false,
    titleBarStyle: 'hidden',
  })

  // Window control IPCs
  ipcMain.on('window-minimize', () => {
    win?.minimize()
  })
  
  ipcMain.on('window-maximize', () => {
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })
  
  ipcMain.on('window-close', () => {
    win?.close()
  })

  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Auto update
  update(win)
}

app.whenReady().then(() => {
  // Register custom protocol for loading local images safely
  protocol.handle('local-asset', (request) => {
    // URL format: local-asset://<filename>
    const url = request.url.replace('local-asset://', '')
    const filePath = path.join(getImagesDir(), decodeURIComponent(url))
    return net.fetch('file://' + filePath)
  })

  createWindow()
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// Initialize database
initDB()

// Database IPC
ipcMain.handle('create-card', (_, card) => dbHandlers.createCard(card))
ipcMain.handle('get-cards', () => dbHandlers.getCards())
ipcMain.handle('delete-card', (_, id) => dbHandlers.deleteCard(id))
ipcMain.handle('search-cards', (_, query) => dbHandlers.searchCards(query))
ipcMain.handle('increment-use-count', (_, id) => dbHandlers.incrementUseCount(id))
ipcMain.handle('get-due-cards', () => dbHandlers.getDueCards())
ipcMain.handle('get-random-cards', (_, limit) => dbHandlers.getRandomCards(limit))
ipcMain.handle('update-card-text', (_, { id, front, back }) => dbHandlers.updateCardText(id, front, back))
ipcMain.handle('review-card', (_, { id, isCorrect }) => dbHandlers.reviewCard(id, isCorrect))

// Settings Handlers
ipcMain.handle('get-settings', () => dbHandlers.getSettings())
ipcMain.handle('save-settings', (_, settings) => dbHandlers.saveSettings(settings))

ipcMain.handle('generate-expression', async (_, { context, style, front }) => {
  const settings = dbHandlers.getSettings()
  return await aiGenerateExpression(context, style, front, settings)
})

ipcMain.handle('generate-glossary', async (_, { domain, front }) => {
  const settings = dbHandlers.getSettings()
  return await aiGenerateGlossary(domain, front, settings)
})

ipcMain.handle('generate-daily-word', async (_, { front }) => {
  const settings = dbHandlers.getSettings()
  return await aiGenerateDailyWord(front, settings)
})

ipcMain.handle('generate-ready-version', async (_, { front }) => {
  const settings = dbHandlers.getSettings()
  return await aiGenerateReadyVersion(front, settings)
})

ipcMain.handle('ai-rewrite-practice', async (_, { text, targetWords }) => {
  const settings = dbHandlers.getSettings()
  return await aiRewritePractice(text, targetWords, settings)
})

ipcMain.handle('get-stats', () => dbHandlers.getStats())
ipcMain.handle('validate-sketch-engine', async (_, { url, apiKey }) => {
  try {
    // Basic ping to Sketch Engine corpus info endpoint
    const targetUrl = url || 'https://api.sketchengine.eu/bonito/run.cgi'
    const res = await fetch(`${targetUrl}/corp_info?corpname=preloaded/ententen15_tt21&format=json`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })
    if (res.ok) {
      return { success: true }
    }
    return { success: false, error: res.statusText }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('validate-ai-api', async (_, { url, apiKey, model }) => {
  try {
    const targetUrl = (url || 'https://api.openai.com/v1').replace(/\/$/, '')
    // A minimal test request assuming an OpenAI-compatible endpoint
    const res = await fetch(`${targetUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1
      })
    })
    
    if (res.ok) {
      return { success: true }
    }
    const errorText = await res.text()
    return { success: false, error: `${res.status} ${res.statusText} - ${errorText.slice(0, 100)}` }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('ping', () => 'pong')

// Image caching
ipcMain.handle('download-image', async (_, url) => {
  return await downloadImage(url)
})
ipcMain.handle('upload-local-image', async () => {
  if (win) {
    return await uploadLocalImage(win)
  }
  return { success: false, error: 'No active window' }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})
