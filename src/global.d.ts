interface Window {
  ipcRenderer: import('electron').IpcRenderer & {
    windowMin: () => void
    windowMax: () => void
    windowClose: () => void
    createCard: (card: any) => Promise<any>
    getCards: () => Promise<any[]>
    deleteCard: (id: number) => Promise<{ success: boolean }>
    getStats: () => Promise<{ cardsReviewed: number, retentionRate: number, cardsToReview: number }>
    getSettings: () => Promise<Record<string, string>>
    saveSettings: (settings: Record<string, string>) => Promise<{ success: boolean }>
    validateSketchEngine: (url: string, apiKey: string) => Promise<{ success: boolean; error?: string }>
    validateAiApi: (url: string, apiKey: string, model: string) => Promise<{ success: boolean; error?: string }>
  }
}
