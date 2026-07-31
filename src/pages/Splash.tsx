import React, { useEffect, useState } from 'react'

interface SplashProps {
  onFinish: () => void
}

export const Splash: React.FC<SplashProps> = ({ onFinish }) => {
  const [dateStr, setDateStr] = useState('')

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

    // Hold for at least 1.5 seconds, could also await a DB ready ping
    const timer = setTimeout(() => {
      onFinish()
    }, 1500)

    return () => clearTimeout(timer)
  }, [onFinish])

  return (
    <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-[#16171d] animate-in fade-in duration-500">
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
  )
}
