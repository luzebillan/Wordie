import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { DOMAINS, getStoredDomainFields } from '../constants/domains'
import { useShortcuts } from '../hooks/useShortcuts'

export interface CardEditFormProps {
  card: any
  onCancel: () => void
  onSave: (updates: { front?: string, back?: string, label?: string, type?: string, style?: string, imageUrl?: string }) => void
}

export const CardEditForm: React.FC<CardEditFormProps> = ({ card, onCancel, onSave }) => {
  if (!card) return null

  switch (card.type) {
    case 'Useful Expressions':
      return <UsefulExpressionsEditForm card={card} onCancel={onCancel} onSave={onSave} />
    case 'Glossary':
      return <GlossaryEditForm card={card} onCancel={onCancel} onSave={onSave} />
    case 'Daily Words':
      return <DailyWordsEditForm card={card} onCancel={onCancel} onSave={onSave} />
    case 'Ready Versions':
      return <ReadyVersionsEditForm card={card} onCancel={onCancel} onSave={onSave} />
    default:
      return <div>Unsupported card type for editing.</div>
  }
}

const UsefulExpressionsEditForm: React.FC<CardEditFormProps> = ({ card, onCancel, onSave }) => {
  const { isActionPressed, getShortcutDisplay } = useShortcuts()
  const [front, setFront] = useState(card.front || '')
  const [back, setBack] = useState(card.back || '')
  const [style, setStyle] = useState(card.style || 'General')

  const handleSave = () => {
    onSave({ front, back, style })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isActionPressed('card.submit', e)) {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [front, back, style, isActionPressed])

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="text-xl font-bold mb-6 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-4">
        Edit Useful Expression
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-6 pl-1 pt-1 pr-2 pb-2">
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Style</label>
          <select 
            value={style}
            onChange={e => setStyle(e.target.value)}
            className="w-full p-3 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200"
          >
            <option value="General">General</option>
            <option value="Formal">Formal</option>
            <option value="Informal">Informal</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Expression (Front)</label>
          <textarea
            value={front}
            onChange={e => setFront(e.target.value)}
            className="w-full p-4 h-24 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200 resize-none font-bold text-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Translation (Back)</label>
          <textarea
            value={back}
            onChange={e => setBack(e.target.value)}
            className="w-full p-4 h-32 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200 resize-none text-lg"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 mt-auto border-t border-gray-100 dark:border-gray-800">
        <button onClick={onCancel} className="px-5 py-2.5 rounded-xl font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
        <button onClick={handleSave} className="px-5 py-2.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors">
          Save Changes
          <span className="text-xs opacity-75 font-normal ml-1">({getShortcutDisplay('card.submit')})</span>
        </button>
      </div>
    </div>
  )
}



const GlossaryEditForm: React.FC<CardEditFormProps> = ({ card, onCancel, onSave }) => {
  const { isActionPressed, getShortcutDisplay } = useShortcuts()
  const frontParts = (card.front || '').split('\n')
  const backParts = (card.back || '').split('\n')
  
  const [targetTerm, setTargetTerm] = useState(frontParts[0] || '')
  const [englishTerm, setEnglishTerm] = useState(frontParts[1] || '')
  const [chineseExp, setChineseExp] = useState(backParts[0] || '')
  const [englishExp, setEnglishExp] = useState(backParts[1] || '')
  
  const initialLabels = card.label ? card.label.split(',').map((l: string) => l.trim()).filter(Boolean) : []
  const [labels, setLabels] = useState<string[]>(initialLabels)
  
  const [domainFields, setDomainFields] = useState<Record<string, string[]>>(getStoredDomainFields())
  const [selectedDomain, setSelectedDomain] = useState(DOMAINS[0])
  const [newFieldInput, setNewFieldInput] = useState('')
  const [confirmDeleteField, setConfirmDeleteField] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem('glossaryDomainFields', JSON.stringify(domainFields))
  }, [domainFields])

  const currentFields = domainFields[selectedDomain] || []

  const toggleLabel = (label: string) => {
    if (labels.includes(label)) {
      setLabels(labels.filter(l => l !== label))
    } else {
      setLabels([...labels, label])
    }
  }

  const handleAddField = () => {
    const fieldName = newFieldInput.trim()
    if (!fieldName) return
    
    setDomainFields(prev => {
      const fields = prev[selectedDomain] || []
      if (fields.includes(fieldName)) return prev
      return {
        ...prev,
        [selectedDomain]: [...fields, fieldName]
      }
    })
    setNewFieldInput('')
    
    const newLabel = `${selectedDomain}\\${fieldName}`
    if (!labels.includes(newLabel)) {
      setLabels(prev => [...prev, newLabel])
    }
  }

  const handleDeleteField = (fieldToDelete: string) => {
    setDomainFields(prev => {
      const fields = prev[selectedDomain] || []
      return {
        ...prev,
        [selectedDomain]: fields.filter(f => f !== fieldToDelete)
      }
    })
    
    const labelToRemove = `${selectedDomain}\\${fieldToDelete}`
    setLabels(prev => prev.filter(l => l !== labelToRemove))
    setConfirmDeleteField(null)
  }

  const handleSave = () => {
    const front = `${targetTerm}\n${englishTerm}`
    const back = `${chineseExp}\n${englishExp}`
    const label = labels.join(', ')
    onSave({ front, back, label })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isActionPressed('card.submit', e)) {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [targetTerm, englishTerm, chineseExp, englishExp, labels, isActionPressed])

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="text-xl font-bold mb-6 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-4">
        Edit Glossary
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-8 pl-1 pt-1 pr-2 pb-2">
        {/* Domain & Fields Editor */}
        <div className="bg-gray-50 dark:bg-[#1f2028]/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-800">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Domain & Fields</label>
          <select
            value={selectedDomain}
            onChange={e => setSelectedDomain(e.target.value)}
            className="w-full p-3 mb-4 bg-white dark:bg-[#2a2b36] border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200"
          >
            {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          
          <div className="flex flex-wrap gap-2 items-center">
            {currentFields.map(field => {
              const labelStr = `${selectedDomain}\\${field}`
              const isSelected = labels.includes(labelStr)
              const isConfirming = confirmDeleteField === field
              return (
                <div key={field} className="group relative inline-flex items-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleLabel(labelStr); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                      isSelected 
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300 dark:border-purple-600' 
                        : 'bg-white dark:bg-[#2a2b36] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-purple-300'
                    }`}
                  >
                    {field}
                  </button>
                  {isConfirming ? (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10 bg-white dark:bg-gray-800 shadow-lg px-2 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50">
                      <button onClick={() => handleDeleteField(field)} className="text-[10px] bg-red-500 text-white px-2 py-1 rounded">Yes</button>
                      <button onClick={() => setConfirmDeleteField(null)} className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteField(field)} className="absolute -top-1.5 -right-1.5 hidden group-hover:flex w-4 h-4 bg-red-500 text-white rounded-full items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )
            })}
            <input 
              type="text" 
              value={newFieldInput}
              onChange={e => setNewFieldInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddField()}
              placeholder="+ Add Field"
              className="px-3 py-1.5 text-sm bg-transparent border border-dashed border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:border-purple-500 w-28"
            />
          </div>
          
          {labels.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {labels.map(label => (
                <span key={label} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-transparent dark:border-purple-800/50 rounded-full text-xs font-medium">
                  {label}
                  <button onClick={() => toggleLabel(label)} className="hover:text-purple-900 dark:hover:text-purple-100 opacity-70 hover:opacity-100 text-sm leading-none">&times;</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 4 Text Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Target Term (正面目标词)</label>
            <input type="text" value={targetTerm} onChange={e => setTargetTerm(e.target.value)} className="w-full p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200 font-bold" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">English Term (英文术语)</label>
            <input type="text" value={englishTerm} onChange={e => setEnglishTerm(e.target.value)} className="w-full p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200 font-bold" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">English Explanation (英文释义)</label>
            <textarea value={englishExp} onChange={e => setEnglishExp(e.target.value)} className="w-full p-4 h-24 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200 resize-none" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Chinese Explanation (中文释义)</label>
            <textarea value={chineseExp} onChange={e => setChineseExp(e.target.value)} className="w-full p-4 h-24 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200 resize-none" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 mt-auto border-t border-gray-100 dark:border-gray-800">
        <button onClick={onCancel} className="px-5 py-2.5 rounded-xl font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
        <button onClick={handleSave} className="px-5 py-2.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors">
          Save Changes
          <span className="text-xs opacity-75 font-normal ml-1">({getShortcutDisplay('card.submit')})</span>
        </button>
      </div>
    </div>
  )
}

const DailyWordsEditForm: React.FC<CardEditFormProps> = ({ card, onCancel, onSave }) => {
  const { isActionPressed, getShortcutDisplay } = useShortcuts()
  const [front, setFront] = useState(card.front || '')
  const [back, setBack] = useState(card.back || '')
  const [imageUrl, setImageUrl] = useState(card.imageUrl || '')

  const handleSave = () => {
    onSave({ front, back, imageUrl })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isActionPressed('card.submit', e)) {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [front, back, imageUrl, isActionPressed])

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="text-xl font-bold mb-6 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-4">
        Edit Daily Word
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-6 pl-1 pt-1 pr-2 pb-2">
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Image URL</label>
          <div className="flex gap-4">
            <input
              type="text"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              className="flex-1 p-3 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200"
              placeholder="https://..."
            />
          </div>
          {imageUrl && (
            <div className="mt-3">
              <img 
                src={imageUrl.startsWith('http') ? imageUrl : `local-asset://${imageUrl}`} 
                alt="Preview" 
                className="h-24 w-auto object-contain rounded-lg border border-gray-200 dark:border-gray-800" 
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Word (Front)</label>
          <input
            type="text"
            value={front}
            onChange={e => setFront(e.target.value)}
            className="w-full p-4 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200 font-bold text-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Meaning (Back)</label>
          <textarea
            value={back}
            onChange={e => setBack(e.target.value)}
            className="w-full p-4 h-32 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200 resize-none text-lg"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 mt-auto border-t border-gray-100 dark:border-gray-800">
        <button onClick={onCancel} className="px-5 py-2.5 rounded-xl font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
        <button onClick={handleSave} className="px-5 py-2.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors">
          Save Changes
          <span className="text-xs opacity-75 font-normal ml-1">({getShortcutDisplay('card.submit')})</span>
        </button>
      </div>
    </div>
  )
}

const ReadyVersionsEditForm: React.FC<CardEditFormProps> = ({ card, onCancel, onSave }) => {
  const { isActionPressed, getShortcutDisplay } = useShortcuts()
  const TYPES = ['Noun Phrase', 'Verb Phrase', 'Adjective Phrase', 'Sentence']
  const [label, setLabel] = useState(card.label || TYPES[0])
  const [front, setFront] = useState(card.front || '')
  const [back, setBack] = useState(card.back || '')

  const handleSave = () => {
    onSave({ front, back, label })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isActionPressed('card.submit', e)) {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [front, back, label, isActionPressed])

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="text-xl font-bold mb-6 text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-4">
        Edit Ready Version
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-6 pl-1 pt-1 pr-2 pb-2">
        <div className="bg-gray-50 dark:bg-[#1f2028]/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Type</label>
          <div className="flex flex-wrap gap-4">
            {TYPES.map(t => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={label === t}
                  onChange={() => setLabel(t)}
                  className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 accent-purple-600 bg-white" 
                />
                <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">{t}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Phrase (Front)</label>
          <textarea
            value={front}
            onChange={e => setFront(e.target.value)}
            className="w-full p-4 h-24 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200 resize-none font-bold text-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Translation (Back)</label>
          <textarea
            value={back}
            onChange={e => setBack(e.target.value)}
            className="w-full p-4 h-24 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200 resize-none text-lg"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 mt-auto border-t border-gray-100 dark:border-gray-800">
        <button onClick={onCancel} className="px-5 py-2.5 rounded-xl font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
        <button onClick={handleSave} className="px-5 py-2.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors">
          Save Changes
          <span className="text-xs opacity-75 font-normal ml-1">({getShortcutDisplay('card.submit')})</span>
        </button>
      </div>
    </div>
  )
}
