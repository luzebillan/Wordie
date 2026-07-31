import React from 'react'

export const Titlebar: React.FC = () => {
  return (
    <div 
      className="h-8 w-full bg-transparent flex justify-between items-center fixed top-0 left-0 right-0 z-[9999]"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <div className="flex-1"></div>
      <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button 
          onClick={() => window.ipcRenderer.minimizeWindow()}
          className="h-full px-4 hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 transition-colors"
        >
          <svg width="10" height="1" viewBox="0 0 10 1"><path fill="currentColor" d="M0 0h10v1H0z"/></svg>
        </button>
        <button 
          onClick={() => window.ipcRenderer.maximizeWindow()}
          className="h-full px-4 hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><path stroke="currentColor" fill="none" d="M.5.5h9v9h-9z"/></svg>
        </button>
        <button 
          onClick={() => window.ipcRenderer.closeWindow()}
          className="h-full px-4 hover:bg-red-500 hover:text-white text-gray-600 dark:text-gray-400 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><path fill="currentColor" d="M10 1L9 0 5 4 1 0 0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4z"/></svg>
        </button>
      </div>
    </div>
  )
}
