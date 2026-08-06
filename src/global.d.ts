interface Window {
  ipcRenderer: import('electron').IpcRenderer & {
    createCard: (card: any) => Promise<any>
    getCards: () => Promise<any[]>
    getCard: (id: number) => Promise<any>
    deleteCard: (id: number) => Promise<{success: boolean}>
    searchCards: (front: string, back?: string, type?: string) => Promise<any[]>
    incrementUseCount: (id: number) => Promise<void>
    incrementEncounterCount: (id: number) => Promise<void>
    incrementManualReviewCount: (id: number) => Promise<void>
    getDueCards: () => Promise<any[]>
    getRandomCards: (limit?: number) => Promise<any[]>
    updateCardText: (id: number, front: string, back: string) => Promise<{ success: boolean; error?: string }>
    reviewCard: (id: number, isCorrect: boolean) => Promise<{ success: boolean; error?: string }>
    getStats: () => Promise<any>
    getStatsByType: (type: string) => Promise<any>
    
    // Data APIs
    exportData: () => Promise<{success: boolean; filePath?: string; count?: number; canceled?: boolean; error?: string}>
    importData: () => Promise<{success: boolean; imported?: number; skipped?: number; canceled?: boolean; error?: string}>
    clearData: () => Promise<{success: boolean; canceled?: boolean; error?: string}>
    
    // Settings APIs
    getSettings: () => Promise<Record<string, string>>
    saveSettings: (settings: Record<string, string>) => Promise<{success: boolean}>
    validateSketchEngine: (url: string, apiKey: string) => Promise<{success: boolean; validUntil?: string; error?: string}>
    validateAiApi: (url: string, apiKey: string, model: string) => Promise<{success: boolean; error?: string}>
    
    // AI APIs
    generateExpression: (context: string, style: string, front: string) => Promise<{success: boolean; result?: string; error?: string}>
    generateGlossary: (domain: string, front: string) => Promise<{success: boolean; result?: string; error?: string}>
    generateDailyWord: (front: string) => Promise<{success: boolean; result?: string; error?: string}>
    generateReadyVersion: (front: string) => Promise<{success: boolean; result?: string; error?: string}>
    aiRewritePractice: (text: string, targetWords: string[]) => Promise<{success: boolean; result?: string; error?: string}>

    // Image APIs
    downloadImage: (url: string) => Promise<{success: boolean; filename?: string; error?: string}>
    uploadLocalImage: () => Promise<{success: boolean; filename?: string; error?: string}>

    // Window Controls
    minimizeWindow: () => void
    maximizeWindow: () => void
    closeWindow: () => void
    onWindowMaximized?: (callback: (maximized: boolean) => void) => void
  }
}
