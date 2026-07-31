import React, { useEffect, useState } from 'react'

interface Stats {
  cardsReviewed: number
  retentionRate: number
  cardsToReview: number
}

export const StatsDashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    cardsReviewed: 0,
    retentionRate: 0,
    cardsToReview: 0
  })

  useEffect(() => {
    window.ipcRenderer.getStats().then(setStats)
  }, [])

  return (
    <div className="grid grid-cols-3 gap-6 mb-8">
      {/* Cards Reviewed */}
      <div className="bg-white/60 dark:bg-black/30 backdrop-blur-md rounded-2xl p-6 border border-white/40 dark:border-white/10 shadow-sm transition-transform hover:scale-[1.02]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Cards Reviewed (Today)</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.cardsReviewed}</h3>
          </div>
        </div>
      </div>

      {/* Retention Rate */}
      <div className="bg-white/60 dark:bg-black/30 backdrop-blur-md rounded-2xl p-6 border border-white/40 dark:border-white/10 shadow-sm transition-transform hover:scale-[1.02]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-green-600 dark:text-green-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Retention Rate</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.retentionRate}%</h3>
          </div>
        </div>
      </div>

      {/* Cards to Review */}
      <div className="bg-white/60 dark:bg-black/30 backdrop-blur-md rounded-2xl p-6 border border-white/40 dark:border-white/10 shadow-sm transition-transform hover:scale-[1.02]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600 dark:text-orange-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Cards to Review</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.cardsToReview}</h3>
          </div>
        </div>
      </div>
    </div>
  )
}
