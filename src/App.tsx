import { useState, useEffect } from 'react'
import { Splash } from './pages/Splash'
import { Dashboard } from './pages/Dashboard'
import { Titlebar } from './components/Titlebar'
import './App.css'

function App() {
  const [showSplash, setShowSplash] = useState<boolean | null>(null)

  useEffect(() => {
    window.ipcRenderer.getSettings().then(settings => {
      if (settings.skipSplashScreen === 'true') {
        setShowSplash(false)
      } else {
        setShowSplash(true)
      }
    })
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
