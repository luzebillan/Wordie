import React from 'react'
import { UsefulExpressions } from './NewCards/UsefulExpressions'
import { Modal, ModalHeader, ModalBody } from './ui/Modal'
import { Sparkles } from 'lucide-react'

interface NewCardModalProps {
  isOpen: boolean
  onClose: () => void
}

export const NewCardModal: React.FC<NewCardModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" className="h-[80vh] max-h-[720px]">
      <ModalHeader
        title="Create a New Expression"
        icon={<Sparkles className="w-5 h-5" />}
        onClose={onClose}
      />
      <ModalBody>
        <UsefulExpressions />
      </ModalBody>
    </Modal>
  )
}
