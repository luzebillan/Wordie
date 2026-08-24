import React, { useState, useEffect } from 'react'
import { Save, X, Settings2 } from 'lucide-react'
import { useShortcuts } from '../hooks/useShortcuts'
import { useGlossaryTaxonomy } from '../hooks/useGlossaryTaxonomy'
import { GlossaryTaxonomySelector } from './GlossaryTaxonomySelector'
import { TaxonomyTagBadge } from './TaxonomyTagBadge'

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
      
      <div className="flex-1 overflow-y-auto space-y-6 pl-1 pt-1 pr-2 pb-2">
        {/* Lightweight Inline Taxonomy Selector */}
        <GlossaryTaxonomySelector
          selectedTags={labels}
          onChange={setLabels}
          onOpenSettings={onCancel}
        />

        {/* 4 Text Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Target Term (正面目标词)</label>
            <input type="text" value={targetTerm} onChange={e => setTargetTerm(e.target.value)} className="w-full p-3.5 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200 font-bold text-base" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">English Term (英文术语)</label>
            <input type="text" value={englishTerm} onChange={e => setEnglishTerm(e.target.value)} className="w-full p-3.5 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200 font-bold text-base" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">English Explanation (英文释义)</label>
            <textarea value={englishExp} onChange={e => setEnglishExp(e.target.value)} className="w-full p-3.5 h-20 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200 resize-none" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Chinese Explanation (中文释义)</label>
            <textarea value={chineseExp} onChange={e => setChineseExp(e.target.value)} className="w-full p-3.5 h-20 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200 resize-none" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 mt-auto border-t border-gray-100 dark:border-gray-800">
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
