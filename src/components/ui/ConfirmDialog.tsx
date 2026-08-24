import React from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal'
import { AlertTriangle, Info, AlertCircle } from 'lucide-react'

export interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'primary'
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
      default:
        return <Info className="w-5 h-5 text-purple-600 dark:text-purple-400" />
    }
  }

  const getConfirmButtonClasses = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-500/20'
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-500/20'
      default:
        return 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/20'
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="sm" closeOnOutsideClick={!isLoading}>
      <ModalHeader
        title={title}
        icon={getIcon()}
        onClose={isLoading ? undefined : onCancel}
      />
      <ModalBody>
        <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          {message}
        </div>
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          disabled={isLoading}
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
        >
          {cancelText}
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={onConfirm}
          className={`px-4 py-2 text-sm font-bold rounded-xl transition-all disabled:opacity-50 ${getConfirmButtonClasses()}`}
        >
          {isLoading ? 'Processing...' : confirmText}
        </button>
      </ModalFooter>
    </Modal>
  )
}
