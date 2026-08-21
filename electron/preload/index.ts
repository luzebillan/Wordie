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
  deleteCards: (ids: number[]) => ipcRenderer.invoke('delete-cards', ids),
  searchCards: (query: string, type?: string) => ipcRenderer.invoke('search-cards', { query, type }),
  findSimilarCards: (front: string, back: string = '', type?: string, useLLM?: boolean, context: string = '') => ipcRenderer.invoke('find-similar-cards', { front, back, type, useLLM, context }),
  incrementUseCount: (id: number) => ipcRenderer.invoke('increment-use-count', id),
  incrementEncounterCount: (id: number) => ipcRenderer.invoke('increment-encounter-count', id),
  incrementManualReviewCount: (id: number) => ipcRenderer.invoke('increment-manual-review-count', id),
  getDueCards: (randomize?: boolean) => ipcRenderer.invoke('get-due-cards', randomize),
  getRandomCards: (limit?: number) => ipcRenderer.invoke('get-random-cards', limit),
  updateCardText: (id: number, front: string, back: string) => ipcRenderer.invoke('update-card-text', { id, front, back }),
  updateCard: (id: number, updates: any) => ipcRenderer.invoke('update-card', { id, updates }),
  resetCardProgress: (id: number) => ipcRenderer.invoke('reset-card-progress', id),
  resetCardsProgress: (ids: number[]) => ipcRenderer.invoke('reset-cards-progress', ids),
  reviewCard: (id: number, isCorrect: boolean, rating?: 'again' | 'hard' | 'good' | 'easy' | 1 | 2 | 3 | 4, elapsedTime?: number) => ipcRenderer.invoke('review-card', { id, isCorrect, rating, elapsedTime }),
  undoReview: () => ipcRenderer.invoke('undo-review'),
  getRevisionStats: () => ipcRenderer.invoke('get-revision-stats'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  getStatsByType: (type: string) => ipcRenderer.invoke('get-stats-by-type', type),
  
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
    generateGlossary: (labels: string[], term: string) => ipcRenderer.invoke('generate-glossary', { labels, term }),
    generateDailyWord: (payload: { picture?: string; context?: string; front?: string }) => ipcRenderer.invoke('generate-daily-word', payload),
    generateReadyVersion: (front: string) => ipcRenderer.invoke('generate-ready-version', { front }),
    generateRevisionCloze: (payload: { front: string; back: string }) => ipcRenderer.invoke('generate-revision-cloze', payload),
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
  },

  // Auto Updater
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  startDownload: () => ipcRenderer.invoke('start-download'),
  cancelDownload: () => ipcRenderer.invoke('cancel-download'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  
  onUpdateCanAvailable: (callback: (info: { update: boolean; version: string; newVersion?: string }) => void) => {
    ipcRenderer.on('update-can-available', (_, info) => callback(info))
  },
  onUpdateError: (callback: (info: { message: string; error: Error }) => void) => {
    ipcRenderer.on('update-error', (_, info) => callback(info))
  },
  onDownloadProgress: (callback: (info: any) => void) => {
    ipcRenderer.on('download-progress', (_, info) => callback(info))
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update-downloaded', () => callback())
  }
})

// Preload script ready
console.log('Preload script loaded')