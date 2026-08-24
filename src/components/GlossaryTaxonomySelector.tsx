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
    if (!trimmed) return

    const res = addField(selectedDomain, trimmed)
    if (res.success) {
      setNewFieldInput('')
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
    <div className={`p-4 bg-gray-50/80 dark:bg-[#1a1b23]/60 rounded-2xl border border-gray-200/70 dark:border-gray-800 space-y-4 ${className}`}>
      
      {/* Header with Title & Settings shortcut */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
          <Tag className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Categories & Tags</span>
        </div>

        <button
          type="button"
          onClick={handleOpenSettings}
          className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 hover:underline transition-colors"
          title="Open settings to manage domain categories and remapping"
        >
          <Settings2 className="w-3 h-3" />
          <span>Manage in Settings</span>
        </button>
      </div>

      {/* Selected Tags Display */}
      <div>
        <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">
          Assigned to this card ({selectedTags.length}):
        </div>
        {selectedTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-white dark:bg-[#1f2028] rounded-xl border border-gray-200/60 dark:border-gray-800">
            {selectedTags.map(tag => (
              <div
                key={tag}
                className="inline-flex items-center gap-1 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200/80 dark:border-purple-800/60 px-2 py-0.5"
              >
                <TaxonomyTagBadge label={tag} size="xs" />
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="p-0.5 rounded-full hover:bg-purple-200/60 dark:hover:bg-purple-800 text-purple-600 dark:text-purple-300 transition-colors"
                  title="Remove tag"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-400 dark:text-gray-500 italic p-2 bg-white/40 dark:bg-[#1f2028]/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
            No categories assigned yet. Click tags below or create one.
          </div>
        )}
      </div>

      {/* Domain Selector & Field Chips */}
      <div className="space-y-2.5 pt-2 border-t border-gray-200/50 dark:border-gray-800/80">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold text-gray-600 dark:text-gray-400 shrink-0">Category:</label>
          <select
            value={selectedDomain}
            onChange={e => setSelectedDomain(e.target.value)}
            className="flex-1 p-1.5 text-xs bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-1 focus:ring-purple-500 outline-none text-gray-800 dark:text-gray-200 font-medium"
          >
            {domains.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Subfields Chips */}
        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 scrollbar-thin">
          {currentFields.map(field => {
            const formatted = formatTaxonomyTag(selectedDomain, field)
            const isSelected = selectedTags.includes(formatted)

            return (
              <button
                key={field}
                type="button"
                onClick={() => toggleTag(selectedDomain, field)}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white dark:bg-[#1f2028] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
                }`}
              >
                {field}
              </button>
            )
          })}
        </div>

        {/* Inline Quick-Add Subfield */}
        <div className="flex items-center gap-1.5 pt-1">
          <input
            type="text"
            placeholder={`+ New field in ${selectedDomain}...`}
            value={newFieldInput}
            onChange={e => setNewFieldInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddNewField()
              }
            }}
            className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-700 outline-none focus:ring-1 focus:ring-purple-500 text-gray-800 dark:text-gray-200 placeholder-gray-400"
          />
          <button
            type="button"
            onClick={handleAddNewField}
            disabled={!newFieldInput.trim()}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Add & Assign
          </button>
        </div>
      </div>

    </div>
  )
}
