interface Window {
  ipcRenderer: import('electron').IpcRenderer & {
    createCard: (card: any) => Promise<any>
    getCards: () => Promise<any[]>
    deleteCard: (id: number) => Promise<{ success: boolean }>
  }
}
