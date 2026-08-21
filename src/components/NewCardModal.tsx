import React, { useEffect } from 'react'
import { UsefulExpressions } from './NewCards/UsefulExpressions'
import { useShortcuts } from '../hooks/useShortcuts'

interface NewCardModalProps {
  isOpen: boolean
  onClose: () => void
}

export const NewCardModal: React.FC<NewCardModalProps> = ({ isOpen, onClose }) => {
  const { isActionPressed } = useShortcuts()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isActionPressed('modal.close', e) && isOpen) {
        onClose()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, isActionPressed])

  if (!isOpen) return null

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed inset-4 sm:inset-10 md:inset-20 z-50 bg-gray-50 dark:bg-[#121212] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1f2028]">
          <h2 className="text-lg font-bold text-purple-700 dark:text-purple-300 monochrome:text-gray-900 dark:monochrome:text-white flex items-center gap-2">
            ✨ Create a New Expression
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 relative">
          <UsefulExpressions />
        </div>
      </div>
    </>
  )
}
