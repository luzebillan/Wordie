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
  getStats: () => ipcRenderer.invoke('get-stats'),
  
  // Settings APIs
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Record<string, string>) => ipcRenderer.invoke('save-settings', settings),
  validateSketchEngine: (url: string, apiKey: string) => ipcRenderer.invoke('validate-sketch-engine', { url, apiKey }),
  validateAiApi: (url: string, apiKey: string, model: string) => ipcRenderer.invoke('validate-ai-api', { url, apiKey, model }),
  
  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close')

  // You can expose other APTs you need here.
  // ...
})

// Removed default useLoading spinner so React Splash can handle it.