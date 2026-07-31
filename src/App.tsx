import { useState } from 'react'
import { Splash } from './pages/Splash'
import { Dashboard } from './pages/Dashboard'
import { Titlebar } from './components/Titlebar'
import './App.css'

function App() {
  const [showSplash, setShowSplash] = useState(true)

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
