import React from 'react'

export const TitleBar: React.FC = () => {
  return (
    <div 
      className="h-8 w-full flex items-center justify-between px-3 fixed top-0 left-0 z-50 select-none text-gray-500"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <div className="flex items-center gap-2 text-xs font-medium">
        {/* Title could go here, or just empty space to drag */}
      </div>
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button 
          onClick={() => window.ipcRenderer.windowMinimize()} 
          className="w-6 h-6 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center transition-colors text-sm"
          title="Minimize"
        >
          ─
        </button>
        <button 
          onClick={() => window.ipcRenderer.windowMaximize()} 
          className="w-6 h-6 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center transition-colors text-sm"
          title="Maximize"
        >
          □
        </button>
        <button 
          onClick={() => window.ipcRenderer.windowClose()} 
          className="w-6 h-6 rounded-full hover:bg-red-500 hover:text-white dark:hover:bg-red-600 flex items-center justify-center transition-colors text-sm"
          title="Close"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
