import { app, BrowserWindow, shell, ipcMain, protocol, net, dialog } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { update } from './update'
import { dbHandlers, initDB } from './db'
import { aiGenerateExpression, aiGenerateGlossary, aiGenerateDailyWord, aiGenerateReadyVersion, aiRewritePractice, practicePureListener, practiceRewrite, practiceAiVersion } from './ai'
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

function saveWindowState() {
  if (win) {
    try {
      const isMaximized = win.isMaximized()
      const bounds = win.getNormalBounds()
      const windowStatePath = path.join(app.getPath('userData'), 'window-state.json')
      fs.writeFileSync(windowStatePath, JSON.stringify({ bounds, isMaximized }))
    } catch (e) {
      console.error('Failed to save window state:', e)
    }
  }
}

async function createWindow() {
  let bounds = { width: 1200, height: 800, x: undefined, y: undefined }
  let isMaximized = false

  try {
    const windowStatePath = path.join(app.getPath('userData'), 'window-state.json')
    if (fs.existsSync(windowStatePath)) {
      const state = JSON.parse(fs.readFileSync(windowStatePath, 'utf8'))
      if (state.bounds) {
        bounds = { ...bounds, ...state.bounds }
      }
      isMaximized = state.isMaximized || false
    }
  } catch (e) {
    console.error('Failed to load window state:', e)
  }

  win = new BrowserWindow({
    title: 'Main window',
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
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

  if (isMaximized) {
    win.maximize()
  }

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

  // Broadcast window state changes
  win.on('maximize', () => {
    win?.webContents.send('window-maximized', true)
  })
  win.on('unmaximize', () => {
    win?.webContents.send('window-maximized', false)
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

  win.on('close', saveWindowState)

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
ipcMain.handle('get-card', (_, id) => dbHandlers.getCard(id))
ipcMain.handle('delete-card', (_, id) => dbHandlers.deleteCard(id))
ipcMain.handle('search-cards', (_, { query, type }) => dbHandlers.searchCards(query, type))
ipcMain.handle('find-similar-cards', (_, { front, back, type, useLLM }) => dbHandlers.findSimilarCards(front, back, type, useLLM))
ipcMain.handle('increment-use-count', (_, id) => dbHandlers.incrementUseCount(id))
ipcMain.handle('increment-encounter-count', (_, id) => dbHandlers.incrementEncounterCount(id))
ipcMain.handle('increment-manual-review-count', (_, id) => dbHandlers.incrementManualReviewCount(id))
ipcMain.handle('get-due-cards', async (_, randomize = false) => {
  return dbHandlers.getDueCards(randomize)
})
ipcMain.handle('get-random-cards', (_, limit) => dbHandlers.getRandomCards(limit))
ipcMain.handle('update-card-text', (_, { id, front, back }) => dbHandlers.updateCardText(id, front, back))
ipcMain.handle('review-card', (_, { id, isCorrect }) => dbHandlers.reviewCard(id, isCorrect))
ipcMain.handle('get-stats-by-type', (_, type) => dbHandlers.getStatsByType(type))
ipcMain.handle('get-revision-stats', () => dbHandlers.getRevisionStats())
ipcMain.handle('undo-review', () => dbHandlers.undoReview())
ipcMain.handle('get-app-version', () => app.getVersion())

// Data Management IPCs
ipcMain.handle('export-data', async () => {
  if (!win) return { success: false, error: 'No active window' }
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export Cards',
    defaultPath: 'cards_backup.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  })
  if (canceled || !filePath) return { success: false, canceled: true }
  
  try {
    const cards = dbHandlers.getCards()
    fs.writeFileSync(filePath, JSON.stringify(cards, null, 2), 'utf-8')
    return { success: true, filePath, count: cards.length }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('import-data', async () => {
  if (!win) return { success: false, error: 'No active window' }
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import Cards',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (canceled || filePaths.length === 0) return { success: false, canceled: true }
  
  try {
    const data = fs.readFileSync(filePaths[0], 'utf-8')
    const cards = JSON.parse(data)
    if (!Array.isArray(cards)) throw new Error('Invalid JSON format: expected an array')
    
    return dbHandlers.importCards(cards)
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('clear-data', async () => {
  if (!win) return { success: false, error: 'No active window' }
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Cancel', 'Yes, Clear Database'],
    defaultId: 0,
    title: 'Clear Database',
    message: 'Are you sure you want to clear the entire database?',
    detail: 'This will delete all cards and review history. Your API settings will be preserved. This action cannot be undone.'
  })
  
  if (response === 1) {
    return dbHandlers.clearDatabase()
  }
  return { success: false, canceled: true }
})

// Settings Handlers
ipcMain.handle('get-settings', () => dbHandlers.getSettings())
ipcMain.handle('save-settings', (_, settings) => dbHandlers.saveSettings(settings))

ipcMain.handle('generate-expression', async (_, { context, style, front }) => {
  const settings = dbHandlers.getSettings()
  return await aiGenerateExpression(context, style, front, settings)
})

ipcMain.handle('generate-glossary', async (_, { labels, term }) => {
  const settings = dbHandlers.getSettings()
  return await aiGenerateGlossary(labels, term, settings)
})

ipcMain.handle('generate-daily-word', async (_, payload: { picture?: string; context?: string; front?: string }) => {
  const settings = dbHandlers.getSettings()
  return await aiGenerateDailyWord(payload, settings)
})

ipcMain.handle('generate-ready-version', async (_, { front }) => {
  const settings = dbHandlers.getSettings()
  return await aiGenerateReadyVersion(front, settings)
})

ipcMain.handle('generate-revision-cloze', async (_, { front, back }) => {
  const settings = dbHandlers.getSettings()
  const { generateRevisionCloze } = await import('./ai')
  return await generateRevisionCloze(front, back, settings)
})

ipcMain.handle('ai-rewrite-practice', async (_, { text, targetWords }) => {
  const settings = dbHandlers.getSettings()
  return await aiRewritePractice(text, targetWords, settings)
})

ipcMain.handle('practice-pure-listener', async (_, text) => {
  const settings = dbHandlers.getSettings()
  return await practicePureListener(text, settings)
})

ipcMain.handle('practice-rewrite', async (_, text) => {
  const settings = dbHandlers.getSettings()
  return await practiceRewrite(text, settings, dbHandlers)
})

ipcMain.handle('practice-ai-version', async (_, text) => {
  const settings = dbHandlers.getSettings()
  return await practiceAiVersion(text, settings)
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
