import { useState, useEffect } from 'react'
import { Splash } from './pages/Splash'
import { Dashboard } from './pages/Dashboard'
import { Titlebar } from './components/Titlebar'
import './App.css'

function App() {
  const [showSplash, setShowSplash] = useState<boolean | null>(null)

  useEffect(() => {
    const applyTheme = (theme: string) => {
      if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    window.ipcRenderer.getSettings().then(settings => {
      const theme = settings.theme || 'system'
      applyTheme(theme)

      if (settings.skipSplashScreen === 'true') {
        setShowSplash(false)
      } else {
        setShowSplash(true)
      }
    })

    const handleSettingsUpdate = () => {
      window.ipcRenderer.getSettings().then(settings => {
        applyTheme(settings.theme || 'system')
      })
    }
    
    window.addEventListener('settings-updated', handleSettingsUpdate)

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleMediaChange = () => {
      window.ipcRenderer.getSettings().then(settings => {
        if ((settings.theme || 'system') === 'system') applyTheme('system')
      })
    }
    mediaQuery.addEventListener('change', handleMediaChange)

    return () => {
      window.removeEventListener('settings-updated', handleSettingsUpdate)
      mediaQuery.removeEventListener('change', handleMediaChange)
    }
  }, [])

  if (showSplash === null) {
    return <div className="h-screen w-full bg-white dark:bg-[#16171d]"></div>
  }

  return (
    <>
      <Titlebar />
      {showSplash ? (
        <Splash onFinish={() => setShowSplash(false)} />
      ) : (
        <Dashboard />
      )}
    </>
  )
}

export default App
