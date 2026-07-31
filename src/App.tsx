import { useState } from 'react'
import { Splash } from './pages/Splash'
import { Dashboard } from './pages/Dashboard'
import { TitleBar } from './components/TitleBar'
import './App.css'

function App() {
  const [showSplash, setShowSplash] = useState(true)

  return (
    <div className="flex flex-col h-screen w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#111216]">
      <TitleBar />
      <div className="flex-1 relative overflow-hidden pt-8">
        {showSplash ? (
          <Splash onFinish={() => setShowSplash(false)} />
        ) : (
          <Dashboard />
        )}
      </div>
    </div>
  )
}

export default App
