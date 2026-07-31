interface Window {
  ipcRenderer: import('electron').IpcRenderer & {
    createCard: (card: any) => Promise<any>
    getCards: () => Promise<any[]>
    deleteCard: (id: number) => Promise<{ success: boolean }>
    getSettings: () => Promise<Record<string, string>>
    saveSettings: (settings: Record<string, string>) => Promise<{ success: boolean }>
    validateSketchEngine: (url: string, apiKey: string) => Promise<{ success: boolean; error?: string }>
  }
}
