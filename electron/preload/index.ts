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
  deleteCard: (id: number) => ipcRenderer.invoke('delete-card', id),
  searchCards: (query: string) => ipcRenderer.invoke('search-cards', query),
  incrementUseCount: (id: number) => ipcRenderer.invoke('increment-use-count', id),
  getStats: () => ipcRenderer.invoke('get-stats'),
  
  // Settings APIs
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Record<string, string>) => ipcRenderer.invoke('save-settings', settings),
  validateSketchEngine: (url: string, apiKey: string) => ipcRenderer.invoke('validate-sketch-engine', { url, apiKey }),
  validateAiApi: (url: string, apiKey: string, model: string) => ipcRenderer.invoke('validate-ai-api', { url, apiKey, model }),

  // AI APIs
  generateExpression: (context: string, style: string, front: string) => ipcRenderer.invoke('generate-expression', { context, style, front }),

  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close')

  // You can expose other APTs you need here.
  // ...
})

// Preload script ready
console.log('Preload script loaded')