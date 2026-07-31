import React, { useEffect, useState } from 'react'

interface SplashProps {
  onFinish: () => void
}

export const Splash: React.FC<SplashProps> = ({ onFinish }) => {
  const [dateStr, setDateStr] = useState('')
  const [stage, setStage] = useState<1 | 2>(1)
  const [stats, setStats] = useState({ cardsReviewed: 0, cardsToReview: 0 })

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

    // Load stats while on stage 1
    window.ipcRenderer.getStats().then(setStats)

    // Sequence: Stage 1 (1.5s) -> Stage 2 (1.5s) -> Finish
    const timer1 = setTimeout(() => {
      setStage(2)
      const timer2 = setTimeout(() => {
        onFinish()
      }, 1500)
      return () => clearTimeout(timer2)
    }, 1500)

    return () => clearTimeout(timer1)
  }, [onFinish])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-white dark:bg-[#16171d] transition-all duration-500 pt-8">
      {stage === 1 ? (
        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
          <div className="flex items-center gap-4 animate-bounce-slow">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-indigo-500 bg-clip-text text-transparent mb-0">
              CardsApp
            </h1>
          </div>
          <p className="text-xl font-medium text-gray-500 dark:text-gray-400 mt-6 tracking-wide">
            Welcome back.
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            {dateStr}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-8">Today's Overview</h2>
          <div className="flex gap-12 text-center">
            <div>
              <p className="text-4xl font-black bg-gradient-to-br from-orange-400 to-red-500 bg-clip-text text-transparent">{stats.cardsToReview}</p>
              <p className="text-sm font-medium text-gray-500 mt-2 uppercase tracking-widest">To Review</p>
            </div>
            <div className="w-px h-16 bg-gray-200 dark:bg-gray-800"></div>
            <div>
              <p className="text-4xl font-black bg-gradient-to-br from-blue-400 to-purple-500 bg-clip-text text-transparent">{stats.cardsReviewed}</p>
              <p className="text-sm font-medium text-gray-500 mt-2 uppercase tracking-widest">Reviewed</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
