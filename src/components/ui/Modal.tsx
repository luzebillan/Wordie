import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useShortcuts } from '../../hooks/useShortcuts'

let activeModalCount = 0

export function getActiveModalCount(): number {
  return activeModalCount
}

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnOutsideClick?: boolean
  closeOnEsc?: boolean
  children: React.ReactNode
  className?: string
}

const sizeClasses: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', string> = {
  sm: 'max-w-md w-full',
  md: 'max-w-xl w-full',
  lg: 'max-w-3xl w-full',
  xl: 'max-w-5xl w-full',
  full: 'max-w-[94vw] w-full h-[90vh]'
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  size = 'md',
  closeOnOutsideClick = true,
  closeOnEsc = true,
  children,
  className = ''
}) => {
  const { isActionPressed } = useShortcuts()
  const backdropRef = useRef<HTMLDivElement>(null)
  const pointerDownOnBackdrop = useRef(false)

  useEffect(() => {
    if (!isOpen) return

    activeModalCount++
    window.dispatchEvent(new CustomEvent('active-modals-changed', { detail: activeModalCount }))

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      activeModalCount = Math.max(0, activeModalCount - 1)
      window.dispatchEvent(new CustomEvent('active-modals-changed', { detail: activeModalCount }))
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen])

  // Handle ESC key
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isActionPressed('modal.close', e) || e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, closeOnEsc, onClose, isActionPressed])

  // Robust pointer tracking: Only close if pointerdown AND pointerup happened on the backdrop directly
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) {
      pointerDownOnBackdrop.current = true
    } else {
      pointerDownOnBackdrop.current = false
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (closeOnOutsideClick && pointerDownOnBackdrop.current && e.target === backdropRef.current) {
      onClose()
    }
    pointerDownOnBackdrop.current = false
  }

  if (!isOpen) return null

  return createPortal(
    <div
      ref={backdropRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/45 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white dark:bg-[#1e1f29] rounded-2xl shadow-2xl border border-gray-200/80 dark:border-white/10 flex flex-col max-h-[88vh] overflow-hidden animate-in zoom-in-95 duration-200 relative ${sizeClasses[size]} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

interface ModalHeaderProps {
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  onClose?: () => void
  showCloseButton?: boolean
  className?: string
  children?: React.ReactNode
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  description,
  icon,
  onClose,
  showCloseButton = true,
  className = '',
  children
}) => {
  const { getShortcutDisplay } = useShortcuts()

  return (
    <div className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800/80 flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-white/[0.02] ${className}`}>
      {children ? (
        children
      ) : (
        <div className="flex items-center gap-3 min-w-0 pr-4">
          {icon && (
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            {title && (
              <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                {description}
              </p>
            )}
          </div>
        </div>
      )}

      {showCloseButton && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
          title={`Close (${getShortcutDisplay('modal.close') || 'Esc'})`}
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

interface ModalBodyProps {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}

export const ModalBody: React.FC<ModalBodyProps> = ({
  children,
  className = '',
  noPadding = false
}) => {
  return (
    <div
      className={`flex-1 overflow-y-auto ${noPadding ? '' : 'p-6'} scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 ${className}`}
    >
      {children}
    </div>
  )
}

interface ModalFooterProps {
  children: React.ReactNode
  className?: string
}

export const ModalFooter: React.FC<ModalFooterProps> = ({
  children,
  className = ''
}) => {
  return (
    <div
      className={`px-6 py-4 border-t border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-white/[0.02] flex items-center justify-end gap-3 shrink-0 ${className}`}
    >
      {children}
    </div>
  )
}
