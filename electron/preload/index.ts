import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
  
  // Database APIs
  createCard: (card: any) => ipcRenderer.invoke('create-card', card),
  getCards: () => ipcRenderer.invoke('get-cards'),
  getCard: (id: number) => ipcRenderer.invoke('get-card', id),
  deleteCard: (id: number) => ipcRenderer.invoke('delete-card', id),
  searchCards: (front: string, back: string = '') => ipcRenderer.invoke('search-cards', { front, back }),
  incrementUseCount: (id: number) => ipcRenderer.invoke('increment-use-count', id),
  incrementEncounterCount: (id: number) => ipcRenderer.invoke('increment-encounter-count', id),
  getDueCards: () => ipcRenderer.invoke('get-due-cards'),
  getRandomCards: (limit?: number) => ipcRenderer.invoke('get-random-cards', limit),
  updateCardText: (id: number, front: string, back: string) => ipcRenderer.invoke('update-card-text', { id, front, back }),
  reviewCard: (id: number, isCorrect: boolean) => ipcRenderer.invoke('review-card', { id, isCorrect }),
  getStats: () => ipcRenderer.invoke('get-stats'),
  
  // Data APIs
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: () => ipcRenderer.invoke('import-data'),
  clearData: () => ipcRenderer.invoke('clear-data'),
  
  // Settings APIs
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Record<string, string>) => ipcRenderer.invoke('save-settings', settings),
  validateSketchEngine: (url: string, apiKey: string) => ipcRenderer.invoke('validate-sketch-engine', { url, apiKey }),
  validateAiApi: (url: string, apiKey: string, model: string) => ipcRenderer.invoke('validate-ai-api', { url, apiKey, model }),

  // AI APIs
  generateExpression: (context: string, style: string, front: string) => ipcRenderer.invoke('generate-expression', { context, style, front }),
  generateGlossary: (domain: string, front: string) => ipcRenderer.invoke('generate-glossary', { domain, front }),
  generateDailyWord: (front: string) => ipcRenderer.invoke('generate-daily-word', { front }),
  generateReadyVersion: (front: string) => ipcRenderer.invoke('generate-ready-version', { front }),
  aiRewritePractice: (text: string, targetWords: string[]) => ipcRenderer.invoke('ai-rewrite-practice', { text, targetWords }),

  // Image APIs
  downloadImage: (url: string) => ipcRenderer.invoke('download-image', url),
  uploadLocalImage: () => ipcRenderer.invoke('upload-local-image'),

  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  onWindowMaximized: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on('window-maximized', (_, isMaximized) => callback(isMaximized))
  }

  // You can expose other APTs you need here.
  // ...
})

// Preload script ready
console.log('Preload script loaded')