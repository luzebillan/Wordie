import { useState } from 'react'
import { Splash } from './pages/Splash'
import { Dashboard } from './pages/Dashboard'
import './App.css'

function App() {
  const [showSplash, setShowSplash] = useState(true)

  if (showSplash) {
    return <Splash onFinish={() => setShowSplash(false)} />
  }

  return <Dashboard />
}

export default App
