interface Window {
  ipcRenderer: import('electron').IpcRenderer & {
    createCard: (card: any) => Promise<any>
    getCards: () => Promise<any[]>
    getCard: (id: number) => Promise<any>
    deleteCard: (id: number) => Promise<{success: boolean}>
    searchCards: (query: string, type?: string) => Promise<any[]>
    findSimilarCards: (front: string, back?: string, type?: string, useLLM?: boolean) => Promise<any[]>
    incrementUseCount: (id: number) => Promise<void>
    incrementEncounterCount: (id: number) => Promise<void>
    incrementManualReviewCount: (id: number) => Promise<void>
    getDueCards: (randomize?: boolean) => Promise<any[]>
    getRandomCards: (limit?: number) => Promise<any[]>
    updateCardText: (id: number, front: string, back: string) => Promise<{ success: boolean; error?: string }>
    reviewCard: (id: number, isCorrect: boolean) => Promise<{ success: boolean; logId?: number; error?: string }>
    getStats: () => Promise<any>
    getStatsByType: (type: string) => Promise<{ cardsReviewed: number; cardsToReview: number }>
    getRevisionStats: () => Promise<{ memorized: number; forgotten: number; toReview: number }>
    undoReview: () => Promise<{ success: boolean; error?: string }>
    
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
    generateGlossary: (labels: string[], term: string) => Promise<{success: boolean; result?: string; error?: string}>
    generateDailyWord: (payload: { picture?: string; context?: string; front?: string }) => Promise<{success: boolean; result?: string; error?: string}>
    generateReadyVersion: (front: string) => Promise<{success: boolean; result?: string; error?: string}>
    generateRevisionCloze: (payload: { front: string; back: string }) => Promise<{ success: boolean; result?: string; error?: string }>
    aiRewritePractice: (text: string, targetWords: string[]) => Promise<{success: boolean; result?: string; error?: string}>
    invoke: (channel: string, data: any) => Promise<any>

    // Image APIs
    downloadImage: (url: string) => Promise<{success: boolean; filename?: string; error?: string}>
    uploadLocalImage: () => Promise<{success: boolean; filename?: string; error?: string}>

    // Window Controls
    minimizeWindow: () => void
    maximizeWindow: () => void
    closeWindow: () => void
    onWindowMaximized?: (callback: (maximized: boolean) => void) => void

    // Auto Updater
    getAppVersion: () => Promise<string>
    checkUpdate: () => Promise<any>
    startDownload: () => Promise<void>
    cancelDownload: () => Promise<void>
    quitAndInstall: () => Promise<void>
    onUpdateCanAvailable: (callback: (info: { update: boolean; version: string; newVersion?: string }) => void) => void
    onUpdateError: (callback: (info: { message: string; error: Error }) => void) => void
    onDownloadProgress: (callback: (info: any) => void) => void
    onUpdateDownloaded: (callback: () => void) => void
  }
}
