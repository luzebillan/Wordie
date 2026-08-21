import React, { useEffect, useState } from 'react'

interface SearchResultsProps {
  query: string
  onNavigate: (view: string, props?: any) => void
}

export const SearchResults: React.FC<SearchResultsProps> = ({ query, onNavigate }) => {
  const [results, setResults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (query) {
      setIsLoading(true)
      window.ipcRenderer.searchCards(query).then(data => {
        setResults(data || [])
        setIsLoading(false)
      })
    }
  }, [query])

  useEffect(() => {
    const handleCardDeleted = (e: any) => {
      const deletedCardId = e.detail
      setResults(prev => prev.filter(card => card.id !== deletedCardId))
    }
    window.addEventListener('card-deleted', handleCardDeleted)
    return () => window.removeEventListener('card-deleted', handleCardDeleted)
  }, [])

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-300">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Search Results</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Found {results.length} cards matching "{query}"
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-4">
        {isLoading ? (
          <div className="text-center text-gray-500 mt-10">Searching...</div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {results.map(card => (
              <div 
                key={card.id} 
                onClick={() => window.dispatchEvent(new CustomEvent('preview-card', { detail: card.id }))}
                className="bg-white dark:bg-[#1f2028] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-purple-300 dark:hover:border-purple-700/50 group"
              >
                <div className="flex justify-between items-start mb-2 gap-4">
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100 line-clamp-2 break-words">{card.front}</div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <div className="text-[10px] px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded uppercase tracking-wider font-bold shrink-0">
                      {card.type}
                    </div>
                    {card.type === 'Useful Expressions' && (
                      <div className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded font-semibold uppercase tracking-wider">
                        {card.style || 'General'}
                      </div>
                    )}
                    {card.type === 'Glossary' && card.label && (
                      <div className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded font-semibold uppercase tracking-wider max-w-[120px] truncate" title={card.label}>
                        {card.label}
                      </div>
                    )}
                    {card.type === 'Ready Versions' && card.label && (
                      <div className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded font-semibold uppercase tracking-wider">
                        {card.label}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3 break-words">{card.back}</div>
                <div className="flex gap-4 text-xs font-medium text-gray-400">
                  <span>Repetitions: {card.repetitions || 0}</span>
                  <span>Interval: {card.interval || 0}d</span>
                  <span>Use Count: {card.useCount || 0}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-10 bg-white/50 dark:bg-[#1f2028]/50 rounded-2xl border border-gray-200 dark:border-gray-800 border-dashed p-12">
            No results found for "{query}".
          </div>
        )}
      </div>
    </div>
  )
}
