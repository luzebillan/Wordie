import React, { useState, useEffect } from 'react'
import { Plus, Settings2, X, Tag } from 'lucide-react'
import { useGlossaryTaxonomy } from '../hooks/useGlossaryTaxonomy'
import { formatTaxonomyTag } from '../constants/domains'
import { TaxonomyTagBadge } from './TaxonomyTagBadge'

interface GlossaryTaxonomySelectorProps {
  selectedTags: string[]
  onChange: (tags: string[]) => void
  onOpenSettings?: () => void
  className?: string
}

export const GlossaryTaxonomySelector: React.FC<GlossaryTaxonomySelectorProps> = ({
  selectedTags,
  onChange,
  onOpenSettings,
  className = ''
}) => {
  const { domains, domainFields, addField } = useGlossaryTaxonomy()
  const [selectedDomain, setSelectedDomain] = useState(domains[0] || 'Life Science')
  const [newFieldInput, setNewFieldInput] = useState('')
  const [isAddingField, setIsAddingField] = useState(false)

  useEffect(() => {
    if (domains.length > 0 && !domains.includes(selectedDomain)) {
      setSelectedDomain(domains[0])
    }
  }, [domains, selectedDomain])

  const currentFields = domainFields[selectedDomain] || []

  const toggleTag = (domainName: string, fieldName: string) => {
    const formatted = formatTaxonomyTag(domainName, fieldName)
    if (selectedTags.includes(formatted)) {
      onChange(selectedTags.filter(t => t !== formatted))
    } else {
      onChange([...selectedTags, formatted])
    }
  }

  const removeTag = (tagToRemove: string) => {
    onChange(selectedTags.filter(t => t !== tagToRemove))
  }

  const handleAddNewField = () => {
    const trimmed = newFieldInput.trim()
    if (!trimmed) {
      setIsAddingField(false)
      return
    }

    const res = addField(selectedDomain, trimmed)
    if (res.success) {
      setNewFieldInput('')
      setIsAddingField(false)
      const newTag = formatTaxonomyTag(selectedDomain, trimmed)
      if (!selectedTags.includes(newTag)) {
        onChange([...selectedTags, newTag])
      }
    }
  }

  const handleOpenSettings = () => {
    window.dispatchEvent(new CustomEvent('open-settings-taxonomy'))
    if (onOpenSettings) onOpenSettings()
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Header with Title & Settings shortcut */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300">
          <Tag className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span>Categories & Tags</span>
        </label>

        <button
          type="button"
          onClick={handleOpenSettings}
          className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 hover:underline transition-colors shrink-0"
          title="Open settings to manage domain categories and taxonomy"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Manage in Settings</span>
        </button>
      </div>

      {/* Control Box */}
      <div className="p-4 bg-gray-50/80 dark:bg-[#1a1b23]/60 rounded-2xl border border-gray-200/80 dark:border-gray-800 space-y-3.5 shadow-xs">
        {/* Category Selector + Quick Field Chips */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category:</span>
            <select
              value={selectedDomain}
              onChange={e => setSelectedDomain(e.target.value)}
              className="p-2 px-3 text-sm bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200 font-semibold shadow-xs"
            >
              {domains.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Subfield chips */}
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            {currentFields.map(field => {
              const formatted = formatTaxonomyTag(selectedDomain, field)
              const isSelected = selectedTags.includes(formatted)

              return (
                <button
                  key={field}
                  type="button"
                  onClick={() => toggleTag(selectedDomain, field)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-600'
                      : 'bg-white dark:bg-[#1f2028] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 hover:text-purple-600 dark:hover:text-purple-400'
                  }`}
                >
                  {field}
                </button>
              )
            })}

            {/* Quick inline add field */}
            {isAddingField ? (
              <div className="inline-flex items-center gap-1">
                <input
                  type="text"
                  autoFocus
                  placeholder={`+ New field...`}
                  value={newFieldInput}
                  onChange={e => setNewFieldInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddNewField()
                    } else if (e.key === 'Escape') {
                      setIsAddingField(false)
                      setNewFieldInput('')
                    }
                  }}
                  onBlur={handleAddNewField}
                  className="px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#1f2028] border border-purple-500 outline-none w-32 text-gray-800 dark:text-gray-200 font-medium"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingField(true)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 border border-dashed border-gray-300 dark:border-gray-700 hover:border-purple-400 transition-colors flex items-center gap-1"
                title="Add new subfield to this category"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Field</span>
              </button>
            )}
          </div>
        </div>

        {/* Assigned Tags */}
        <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-gray-200/60 dark:border-gray-800/80">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 shrink-0">Assigned:</span>
          {selectedTags.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedTags.map(tag => (
                <TaxonomyTagBadge
                  key={tag}
                  label={tag}
                  size="sm"
                  onRemove={() => removeTag(tag)}
                />
              ))}
            </div>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500 italic">No categories assigned yet. Click any field chip above to assign.</span>
          )}
        </div>
      </div>
    </div>
  )
}
