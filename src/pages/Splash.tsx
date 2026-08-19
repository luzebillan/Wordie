import React, { useEffect, useState } from 'react'

interface SplashProps {
  onFinish: () => void
}

export const Splash: React.FC<SplashProps> = ({ onFinish }) => {
  const [dateStr, setDateStr] = useState('')
  const [stage, setStage] = useState<1 | 2 | 3>(1)
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

    let isMounted = true

    const loadData = async () => {
      // 保证至少显示 800ms，防止界面一闪而过
      const minDelay = new Promise(resolve => setTimeout(resolve, 800))
      const statsFetch = window.ipcRenderer?.getStats 
        ? window.ipcRenderer.getStats() 
        : Promise.resolve({ cardsReviewed: 0, cardsToReview: 0 })
      
      const [, fetchedStats] = await Promise.all([minDelay, statsFetch])
      
      if (!isMounted) return
      setStats(fetchedStats)
      
      // 展开数据概览 (Stage 2)
      setStage(2)
      
      // 给用户 1.5s 时间阅读数字
      setTimeout(() => {
        if (!isMounted) return
        setStage(3) // 整体退场动画
        setTimeout(() => {
          if (!isMounted) return
          onFinish()
        }, 500) // 等待 500ms 退场动画完成
      }, 1500)
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [onFinish])

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen w-full bg-white dark:bg-[#16171d] transition-all duration-500 overflow-hidden ${stage === 3 ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
      
      <div className="flex flex-col items-center">
        <div className="flex flex-col items-center">
          <h1 className="text-6xl bg-gradient-to-r from-purple-600 to-indigo-500 monochrome:from-gray-800 monochrome:to-black dark:monochrome:from-gray-300 dark:monochrome:to-white bg-clip-text text-transparent mb-0 tracking-tight" style={{ fontFamily: "'Forte', cursive, sans-serif" }}>
            Welcome
          </h1>
          <p className="text-sm font-medium text-gray-400 dark:text-gray-500 mt-3">
            {dateStr}
          </p>
        </div>

        {/* 数据面板，使用 grid 行高过渡来实现完美的流式展开，拉大间距避免紧贴 */}
        <div className={`grid transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${stage >= 2 ? 'grid-rows-[1fr] opacity-100 mt-16' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
          <div className="overflow-hidden">
            <div className={`transition-all duration-700 delay-100 ${stage >= 2 ? 'translate-y-0' : 'translate-y-8'}`}>
              <div className="flex flex-col gap-4 bg-gray-50/50 dark:bg-gray-800/30 backdrop-blur-xl px-10 py-8 rounded-3xl border border-gray-100 dark:border-gray-800/50 shadow-xl shadow-purple-500/5 dark:shadow-none monochrome:shadow-gray-500/5 min-w-[280px]">
                <div className="flex justify-between items-center w-full">
                  <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Cards To Review</p>
                  <p className="text-3xl font-black bg-gradient-to-br from-orange-400 to-red-500 monochrome:from-gray-700 monochrome:to-black dark:monochrome:from-gray-300 dark:monochrome:to-white bg-clip-text text-transparent drop-shadow-sm">{stats.cardsToReview}</p>
                </div>
                <div className="h-px self-stretch bg-gray-200 dark:bg-gray-800/80 mx-2"></div>
                <div className="flex justify-between items-center w-full">
                  <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Cards Reviewed</p>
                  <p className="text-3xl font-black bg-gradient-to-br from-blue-400 to-purple-500 monochrome:from-gray-700 monochrome:to-black dark:monochrome:from-gray-300 dark:monochrome:to-white bg-clip-text text-transparent drop-shadow-sm">{stats.cardsReviewed}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  )
}
