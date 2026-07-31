import React, { useEffect, useState } from 'react'

interface SplashProps {
  onFinish: () => void
}

interface Stats {
  cardsReviewed: number
  retentionRate: number
  cardsToReview: number
}

export const Splash: React.FC<SplashProps> = ({ onFinish }) => {
  const [phase, setPhase] = useState<1 | 2>(1)
  const [dateStr, setDateStr] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    // Format date as Jul. 28th, 2026
    const date = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const parts = formatter.formatToParts(date)
    let month = '', day = '', year = ''
    parts.forEach(p => {
      if (p.type === 'month') month = p.value
      if (p.type === 'day') day = p.value
      if (p.type === 'year') year = p.value
    })
    
    const suffix = (d: string) => {
      const num = parseInt(d, 10)
      if (num > 3 && num < 21) return 'th'
      switch (num % 10) {
        case 1: return 'st'
        case 2: return 'nd'
        case 3: return 'rd'
        default: return 'th'
      }
    }

    setDateStr(`${month}. ${day}${suffix(day)}, ${year}`)
    
    // Load stats in background
    window.ipcRenderer.getStats().then(setStats)

    // Phase 1 -> 2
    const timer1 = setTimeout(() => {
      setPhase(2)
    }, 1500)

    // Phase 2 -> Finish
    const timer2 = setTimeout(() => {
      onFinish()
    }, 3500)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [onFinish])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#111216] w-full titlebar-drag">
      {phase === 1 ? (
        <div className="animate-in fade-in zoom-in duration-500 flex flex-col items-center">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-500 to-indigo-400 bg-clip-text text-transparent mb-0">
            Welcome
          </h1>
          <p className="text-gray-400 font-medium mt-4 tracking-wide text-lg">
            {dateStr}
          </p>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center max-w-md w-full px-6">
          <h2 className="text-2xl font-bold text-white mb-8">Today's Overview</h2>
          <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md flex justify-around">
            <div className="text-center">
              <p className="text-4xl font-bold text-blue-400 mb-2">{stats?.cardsToReview || 0}</p>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">To Review</p>
            </div>
            <div className="w-px bg-white/10"></div>
            <div className="text-center">
              <p className="text-4xl font-bold text-purple-400 mb-2">{stats?.cardsReviewed || 0}</p>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Reviewed</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
