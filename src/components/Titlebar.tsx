import React, { useState, useEffect } from 'react'

export const Titlebar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (window.ipcRenderer.onWindowMaximized) {
      window.ipcRenderer.onWindowMaximized((maximized) => {
        setIsMaximized(maximized)
      })
    }
  }, [])

  return (
    <div 
      className="h-10 w-full bg-transparent flex justify-between items-center fixed top-0 left-0 right-0 z-[9999]"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <div className="flex-1"></div>
      <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button 
          onClick={() => window.ipcRenderer.minimizeWindow()}
          className="h-full w-[46px] hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors flex items-center justify-center"
          title="Minimize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path fill="currentColor" d="M0 4h10v1H0z" />
          </svg>
        </button>
        <button 
          onClick={() => window.ipcRenderer.maximizeWindow()}
          className="h-full w-[46px] hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors flex items-center justify-center"
          title={isMaximized ? "Restore Down" : "Maximize"}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path fill="currentColor" d="M2 0h8v8H2V0zm1 1v6h6V1H3zM0 2h2v1H1v6h6V8h1v2H0V2z" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path fill="currentColor" d="M0 0h10v10H0V0zm1 1v8h8V1H1z" />
            </svg>
          )}
        </button>
        <button 
          onClick={() => window.ipcRenderer.closeWindow()}
          className="h-full w-[46px] hover:bg-red-500 hover:text-white text-gray-600 dark:text-gray-400 transition-colors flex items-center justify-center"
          title="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path fill="currentColor" d="M10 1L9 0 5 4 1 0 0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
