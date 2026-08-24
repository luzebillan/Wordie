import React, { useState, useEffect } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Layers,
  AlertTriangle,
  Check,
  ArrowRightLeft,
  Sparkles,
  ShieldCheck,
  X
} from 'lucide-react'
import { useGlossaryTaxonomy } from '../hooks/useGlossaryTaxonomy'
import { formatTaxonomyTag } from '../constants/domains'

interface GlossaryTaxonomyManagerProps {
  initialSelectedDomain?: string
  className?: string
}

export const GlossaryTaxonomyManager: React.FC<GlossaryTaxonomyManagerProps> = ({
  initialSelectedDomain,
  className = ''
}) => {
  const {
    taxonomy,
    counts,
    isLoadingCounts,
    orphans,
    totalOrphanCards,
    refreshCounts,
    scanOrphans,
    addDomain,
    renameDomain,
    deleteDomain,
    reorderDomains,
    addField,
    batchAddFields,
    renameField,
    deleteField,
    resetToDefault,
    adoptOrphanTag,
    adoptAllOrphans,
    remapOrphanTag,
    autoMigrateKnownLegacyTags
  } = useGlossaryTaxonomy()

  const [selectedDomainName, setSelectedDomainName] = useState<string>('')
  const [newDomainInput, setNewDomainInput] = useState('')
  const [newFieldInput, setNewFieldInput] = useState('')
  const [batchInput, setBatchInput] = useState('')
  const [showBatchAdd, setShowBatchAdd] = useState(false)

  // Editing state
  const [editingDomainName, setEditingDomainName] = useState<string | null>(null)
  const [domainEditValue, setDomainEditValue] = useState('')
  const [editingFieldName, setEditingFieldName] = useState<string | null>(null)
  const [fieldEditValue, setFieldEditValue] = useState('')

  // Contextual Dialog States (scoped inside panel)
  const [domainToDelete, setDomainToDelete] = useState<string | null>(null)
  const [deleteDomainStrategy, setDeleteDomainStrategy] = useState<'transfer' | 'uncategorized' | 'detach'>('transfer')
  const [transferTargetDomain, setTransferTargetDomain] = useState<string>('')

  const [fieldToDelete, setFieldToDelete] = useState<{ domain: string; field: string } | null>(null)
  const [fieldDeleteStrategy, setFieldDeleteStrategy] = useState<'detach' | 'merge'>('detach')
  const [mergeTargetField, setMergeTargetField] = useState<string>('')

  const [remappingOrphanTag, setRemappingOrphanTag] = useState<string | null>(null)
  const [selectedRemapDomain, setSelectedRemapDomain] = useState<string>('')
  const [selectedRemapField, setSelectedRemapField] = useState<string>('')

  const [confirmResetModal, setConfirmResetModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    refreshCounts()
    scanOrphans()
    setErrorMessage('')
    setSuccessMessage('')
    if (initialSelectedDomain && taxonomy.some(t => t.name === initialSelectedDomain)) {
      setSelectedDomainName(initialSelectedDomain)
    } else if (taxonomy.length > 0 && (!selectedDomainName || !taxonomy.some(t => t.name === selectedDomainName))) {
      setSelectedDomainName(taxonomy[0].name)
    }
  }, [initialSelectedDomain, taxonomy])

  const currentDomainItem = taxonomy.find(t => t.name === selectedDomainName) || taxonomy[0]
  const currentDomainFields = currentDomainItem ? currentDomainItem.fields : []

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg)
      setTimeout(() => setErrorMessage(''), 4000)
    } else {
      setSuccessMessage(msg)
      setTimeout(() => setSuccessMessage(''), 3000)
    }
  }

  // --- Handlers: Domain ---
  const handleAddDomain = () => {
    const res = addDomain(newDomainInput)
    if (res.success) {
      setSelectedDomainName(newDomainInput.trim())
      setNewDomainInput('')
      showToast('Category created successfully.')
    } else {
      showToast(res.error || 'Failed to create category.', true)
    }
  }

  const handleStartEditDomain = (domainName: string) => {
    setEditingDomainName(domainName)
    setDomainEditValue(domainName)
  }

  const handleSaveEditDomain = async (oldName: string) => {
    if (!domainEditValue.trim() || domainEditValue.trim() === oldName) {
      setEditingDomainName(null)
      return
    }
    const res = await renameDomain(oldName, domainEditValue)
    if (res.success) {
      if (selectedDomainName === oldName) {
        setSelectedDomainName(domainEditValue.trim())
      }
      setEditingDomainName(null)
      showToast(`Category renamed to "${domainEditValue.trim()}".`)
    } else {
      showToast(res.error || 'Failed to rename category.', true)
    }
  }

  const handleMoveDomain = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= taxonomy.length) return

    const reordered = [...taxonomy]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    reorderDomains(reordered)
  }

  const handleRequestDeleteDomain = (domainName: string) => {
    const count = counts.domainCounts[domainName] || 0
    const otherDomains = taxonomy.filter(t => t.name !== domainName)
    if (count > 0 && otherDomains.length > 0) {
      setTransferTargetDomain(otherDomains[0].name)
      setDeleteDomainStrategy('transfer')
    } else {
      setDeleteDomainStrategy('detach')
    }
    setDomainToDelete(domainName)
  }

  const handleConfirmDeleteDomain = async () => {
    if (!domainToDelete) return
    const res = await deleteDomain(
      domainToDelete,
      deleteDomainStrategy,
      deleteDomainStrategy === 'transfer' ? transferTargetDomain : undefined
    )
    if (res.success) {
      showToast(`Category "${domainToDelete}" deleted.`)
      setDomainToDelete(null)
    } else {
      showToast(res.error || 'Failed to delete category.', true)
    }
  }

  // --- Handlers: Field ---
  const handleAddField = () => {
    if (!selectedDomainName) return
    const res = addField(selectedDomainName, newFieldInput)
    if (res.success) {
      setNewFieldInput('')
      showToast('Field added.')
    } else {
      showToast(res.error || 'Failed to add field.', true)
    }
  }

  const handleBatchAddFields = () => {
    if (!selectedDomainName || !batchInput.trim()) return
    const res = batchAddFields(selectedDomainName, batchInput)
    if (res.success) {
      setBatchInput('')
      setShowBatchAdd(false)
      showToast(`Successfully added ${res.addedCount} field(s).`)
    } else {
      showToast(res.error || 'Failed to batch add fields.', true)
    }
  }

  const handleStartEditField = (fieldName: string) => {
    setEditingFieldName(fieldName)
    setFieldEditValue(fieldName)
  }

  const handleSaveEditField = async (domainName: string, oldFieldName: string) => {
    if (!fieldEditValue.trim() || fieldEditValue.trim() === oldFieldName) {
      setEditingFieldName(null)
      return
    }
    const res = await renameField(domainName, oldFieldName, fieldEditValue)
    if (res.success) {
      setEditingFieldName(null)
      showToast(`Field renamed to "${fieldEditValue.trim()}".`)
    } else {
      showToast(res.error || 'Failed to rename field.', true)
    }
  }

  const handleRequestDeleteField = (domainName: string, fieldName: string) => {
    const fieldKey = formatTaxonomyTag(domainName, fieldName)
    const count = counts.fieldCounts[fieldKey] || 0
    const otherFields = currentDomainFields.filter(f => f !== fieldName)
    if (count > 0 && otherFields.length > 0) {
      setMergeTargetField(otherFields[0])
      setFieldDeleteStrategy('detach')
    } else {
      setFieldDeleteStrategy('detach')
    }
    setFieldToDelete({ domain: domainName, field: fieldName })
  }

  const handleConfirmDeleteField = async () => {
    if (!fieldToDelete) return
    const res = await deleteField(
      fieldToDelete.domain,
      fieldToDelete.field,
      fieldDeleteStrategy === 'merge' ? mergeTargetField : undefined
    )
    if (res.success) {
      showToast(`Field "${fieldToDelete.field}" deleted.`)
      setFieldToDelete(null)
    } else {
      showToast(res.error || 'Failed to delete field.', true)
    }
  }

  const handleConfirmReset = () => {
    resetToDefault()
    setConfirmResetModal(false)
    showToast('Taxonomy reset to default categories.')
  }

  // --- Handlers: Orphan Doctor ---
  const handleAdoptAll = () => {
    const res = adoptAllOrphans()
    if (res.success) {
      showToast(`Adopted ${res.count} unmapped tag(s) into taxonomy.`)
    }
  }

  const handleStartRemapOrphan = (orphanTag: string) => {
    setRemappingOrphanTag(orphanTag)
    if (taxonomy.length > 0) {
      setSelectedRemapDomain(taxonomy[0].name)
      setSelectedRemapField(taxonomy[0].fields[0] || '')
    }
  }

  const handleConfirmRemapOrphan = async () => {
    if (!remappingOrphanTag || !selectedRemapDomain) return
    const targetTag = selectedRemapField ? formatTaxonomyTag(selectedRemapDomain, selectedRemapField) : selectedRemapDomain
    const res = await remapOrphanTag(remappingOrphanTag, targetTag)
    if (res.success) {
      showToast(`Re-mapped "${remappingOrphanTag}" to "${targetTag}".`)
      setRemappingOrphanTag(null)
    } else {
      showToast(res.error || 'Failed to remap orphan tag.', true)
    }
  }

  const handleDetachOrphan = async (orphanTag: string) => {
    const res = await remapOrphanTag(orphanTag, '')
    if (res.success) {
      showToast(`Removed tag "${orphanTag}" from all affected cards.`)
      setRemappingOrphanTag(null)
    } else {
      showToast(res.error || 'Failed to detach tag.', true)
    }
  }

  const orphanKeys = Object.keys(orphans)

  return (
    <div className={`flex flex-col h-full relative overflow-hidden bg-white/40 dark:bg-black/10 rounded-2xl border border-gray-100 dark:border-gray-800 ${className}`}>
      
      {/* Toast Notification Bar */}
      {errorMessage && (
        <div className="m-3 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center justify-between animate-in fade-in shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="p-1 hover:opacity-75"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {successMessage && (
        <div className="m-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between animate-in fade-in shrink-0">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="p-1 hover:opacity-75"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* --- Taxonomy Doctor: Orphan / Legacy Tags Banner --- */}
      {orphanKeys.length > 0 && (
        <div className="m-3 p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in duration-200 shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-1.5 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 mt-0.5 shrink-0">
              <AlertTriangle className="w-4 h-4 shrink-0" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <span>Taxonomy Doctor: Found {orphanKeys.length} unmapped tag(s) ({totalOrphanCards} cards)</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {orphanKeys.slice(0, 4).map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-100/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200"
                  >
                    <span>{tag}</span>
                    <span className="opacity-70 font-sans text-[10px]">({orphans[tag].count})</span>
                    <button
                      onClick={() => handleStartRemapOrphan(tag)}
                      className="ml-1 text-amber-800 dark:text-amber-200 hover:text-amber-950 font-sans text-[10px] underline"
                    >
                      Remap
                    </button>
                  </span>
                ))}
                {orphanKeys.length > 4 && (
                  <span className="text-[11px] text-amber-700 dark:text-amber-300 self-center">
                    +{orphanKeys.length - 4} more
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              onClick={async () => {
                const res = await autoMigrateKnownLegacyTags()
                if (res.success) {
                  showToast(`Auto-migrated ${res.affectedCount || 0} card(s) to new categories!`)
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition-colors"
              title="Automatically migrate known legacy categories"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Upgrade All ({totalOrphanCards})</span>
            </button>
            <button
              onClick={handleAdoptAll}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-colors"
              title="Automatically add all unmapped tags to your category tree"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adopt All</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Master-Detail Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Left Column: Domains (Level 1) */}
        <div className="w-72 border-r border-gray-200/70 dark:border-gray-800 flex flex-col bg-gray-50/40 dark:bg-black/20 shrink-0">
          <div className="p-3.5 border-b border-gray-200/60 dark:border-gray-800 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Categories (一级分类)</span>
            <span className="text-[11px] text-gray-400 font-medium">{taxonomy.length} total</span>
          </div>

          {/* Domains List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 scrollbar-thin">
            {taxonomy.map((domain, idx) => {
              const isSelected = domain.name === selectedDomainName
              const isEditing = editingDomainName === domain.name
              const cardCount = counts.domainCounts[domain.name] || 0

              return (
                <div
                  key={domain.id || domain.name}
                  onClick={() => {
                    if (!isEditing) setSelectedDomainName(domain.name)
                  }}
                  className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 shadow-xs'
                      : 'bg-white dark:bg-[#1f2028] border-gray-100 dark:border-gray-800/80 hover:border-gray-300 dark:hover:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0 pr-1">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 w-full" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={domainEditValue}
                          onChange={e => setDomainEditValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveEditDomain(domain.name)
                            if (e.key === 'Escape') setEditingDomainName(null)
                          }}
                          className="w-full px-2 py-1 text-xs rounded-lg border border-purple-400 dark:border-purple-600 bg-white dark:bg-[#16171d] outline-none text-gray-800 dark:text-gray-200"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEditDomain(domain.name)}
                          className="p-1 rounded bg-purple-600 text-white hover:bg-purple-700"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setEditingDomainName(null)}
                          className="p-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-semibold truncate">{domain.name}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded-md ${
                          isSelected ? 'bg-purple-200/70 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                        }`}>
                          {cardCount}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Actions on hover */}
                  {!isEditing && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveDomain(idx, 'up')
                        }}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 disabled:opacity-20"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMoveDomain(idx, 'down')
                        }}
                        disabled={idx === taxonomy.length - 1}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 disabled:opacity-20"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartEditDomain(domain.name)
                        }}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600"
                        title="Rename"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRequestDeleteDomain(domain.name)
                        }}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add Category Input */}
          <div className="p-3 border-t border-gray-200/60 dark:border-gray-800 bg-white/50 dark:bg-black/10 shrink-0">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="+ New Category Name..."
                value={newDomainInput}
                onChange={e => setNewDomainInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddDomain()
                }}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-700 outline-none focus:ring-1 focus:ring-purple-500 text-gray-800 dark:text-gray-200"
              />
              <button
                onClick={handleAddDomain}
                disabled={!newDomainInput.trim()}
                className="p-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white transition-colors"
                title="Add Category"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Fields (Level 2) & Tools */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#1a1b23]">
          {currentDomainItem ? (
            <>
              {/* Header for Selected Category */}
              <div className="px-5 py-3.5 border-b border-gray-200/60 dark:border-gray-800 flex items-center justify-between shrink-0 bg-gray-50/30 dark:bg-black/5">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>{currentDomainItem.name}</span>
                    <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400">
                      ({currentDomainFields.length} subfields · {counts.domainCounts[currentDomainItem.name] || 0} cards)
                    </span>
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowBatchAdd(!showBatchAdd)}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {showBatchAdd ? 'Hide Batch Add' : 'Batch Add Fields'}
                  </button>
                </div>
              </div>

              {/* Batch Add Section (Collapsible) */}
              {showBatchAdd && (
                <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border-b border-purple-100 dark:border-purple-900/40 animate-in slide-in-from-top-2 shrink-0">
                  <label className="block text-xs font-bold text-purple-900 dark:text-purple-200 mb-1.5">
                    Paste comma-separated or newline-separated fields:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Immunology, Pathology, Genomics, Biochemistry"
                    value={batchInput}
                    onChange={e => setBatchInput(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-white dark:bg-[#1f2028] border border-purple-200 dark:border-purple-800 outline-none focus:ring-1 focus:ring-purple-500 text-gray-800 dark:text-gray-200 resize-none font-mono"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => setShowBatchAdd(false)}
                      className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBatchAddFields}
                      disabled={!batchInput.trim()}
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                    >
                      Import Fields
                    </button>
                  </div>
                </div>
              )}

              {/* Subfields Grid */}
              <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {currentDomainFields.map(field => {
                    const isEditing = editingFieldName === field
                    const tagKey = formatTaxonomyTag(currentDomainItem.name, field)
                    const cardCount = counts.fieldCounts[tagKey] || 0

                    return (
                      <div
                        key={field}
                        className="group flex items-center justify-between p-2.5 rounded-xl border border-gray-200/80 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1f2028]/60 hover:bg-white dark:hover:bg-[#1f2028] transition-all"
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1 w-full">
                            <input
                              type="text"
                              value={fieldEditValue}
                              onChange={e => setFieldEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveEditField(currentDomainItem.name, field)
                                if (e.key === 'Escape') setEditingFieldName(null)
                              }}
                              className="flex-1 px-2 py-0.5 text-xs rounded border border-purple-400 bg-white dark:bg-[#16171d] outline-none text-gray-800 dark:text-gray-200"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEditField(currentDomainItem.name, field)}
                              className="p-1 rounded bg-purple-600 text-white"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingFieldName(null)}
                              className="p-1 rounded bg-gray-200 text-gray-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5 min-w-0 pr-1">
                              <span className="text-xs text-gray-800 dark:text-gray-200 font-medium truncate">
                                {field}
                              </span>
                              {cardCount > 0 && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold">
                                  {cardCount}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleStartEditField(field)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                title="Rename Field"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleRequestDeleteField(currentDomainItem.name, field)}
                                className="p-1 text-gray-400 hover:text-red-500"
                                title="Delete Field"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>

                {currentDomainFields.length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-xs">
                    No subfields yet in this category. Add one below or use Batch Add.
                  </div>
                )}
              </div>

              {/* Add Single Field Input Footer */}
              <div className="p-4 border-t border-gray-200/60 dark:border-gray-800 bg-gray-50/50 dark:bg-black/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 w-full max-w-md">
                  <input
                    type="text"
                    placeholder={`+ Add field to "${currentDomainItem.name}"...`}
                    value={newFieldInput}
                    onChange={e => setNewFieldInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddField()
                    }}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-700 outline-none focus:ring-1 focus:ring-purple-500 text-gray-800 dark:text-gray-200"
                  />
                  <button
                    onClick={handleAddField}
                    disabled={!newFieldInput.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                  >
                    Add Field
                  </button>
                </div>

                <button
                  onClick={() => setConfirmResetModal(true)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors font-medium ml-4 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default Categories</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-xs">
              Select or create a category from the left.
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* IN-PANEL CONTEXTUAL DIALOG OVERLAYS (No global window backdrops!)         */}
      {/* ========================================================================= */}

      {/* --- In-Panel Remap Orphan Tag Dialog --- */}
      {remappingOrphanTag && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#1f2028] w-full max-w-md p-5 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 animate-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-purple-600 dark:text-purple-400 mb-3">
              <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/50">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Remap Unmatched Tag
                </h4>
                <p className="text-[11px] font-mono text-gray-500">{remappingOrphanTag}</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
              Currently <strong className="text-purple-600 dark:text-purple-400">{orphans[remappingOrphanTag]?.count || 0} cards</strong> use this tag. Select a destination category:
            </p>

            <div className="space-y-2.5 mb-5">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">Target Category (一级分类)</label>
                <select
                  value={selectedRemapDomain}
                  onChange={e => {
                    const d = e.target.value
                    setSelectedRemapDomain(d)
                    const dItem = taxonomy.find(t => t.name === d)
                    setSelectedRemapField(dItem?.fields[0] || '')
                  }}
                  className="w-full p-2 bg-gray-50 dark:bg-[#16171d] border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none text-gray-800 dark:text-gray-200"
                >
                  {taxonomy.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">Target Field (二级分类 - 可选)</label>
                <select
                  value={selectedRemapField}
                  onChange={e => setSelectedRemapField(e.target.value)}
                  className="w-full p-2 bg-gray-50 dark:bg-[#16171d] border border-gray-200 dark:border-gray-700 rounded-xl text-xs outline-none text-gray-800 dark:text-gray-200"
                >
                  <option value="">(No specific field - domain only)</option>
                  {(taxonomy.find(t => t.name === selectedRemapDomain)?.fields || []).map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => handleDetachOrphan(remappingOrphanTag)}
                className="text-xs text-red-500 hover:text-red-700 font-semibold"
              >
                Detach from Cards
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setRemappingOrphanTag(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRemapOrphan}
                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Confirm Remap
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- In-Panel Safe Deletion for Category --- */}
      {domainToDelete && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#1f2028] w-full max-w-md p-5 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 animate-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-red-500 mb-3">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/50">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                Delete Category "{domainToDelete}"?
              </h4>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
              {(counts.domainCounts[domainToDelete] || 0) > 0 ? (
                <>
                  There are currently <strong className="text-purple-600 dark:text-purple-400">{counts.domainCounts[domainToDelete]} cards</strong> using this category:
                </>
              ) : (
                'Are you sure you want to delete this category? No existing cards are using it.'
              )}
            </p>

            {(counts.domainCounts[domainToDelete] || 0) > 0 && (
              <div className="space-y-2 mb-4">
                {taxonomy.filter(t => t.name !== domainToDelete).length > 0 && (
                  <label className="flex items-start gap-2 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer bg-gray-50 dark:bg-[#16171d]">
                    <input
                      type="radio"
                      name="domainStrategy"
                      checked={deleteDomainStrategy === 'transfer'}
                      onChange={() => setDeleteDomainStrategy('transfer')}
                      className="mt-0.5 accent-purple-600"
                    />
                    <div className="flex-1 text-xs">
                      <div className="font-bold text-gray-800 dark:text-gray-200">Transfer cards to another category</div>
                      <select
                        value={transferTargetDomain}
                        onChange={e => setTransferTargetDomain(e.target.value)}
                        disabled={deleteDomainStrategy !== 'transfer'}
                        className="mt-1.5 w-full p-1.5 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none"
                      >
                        {taxonomy
                          .filter(t => t.name !== domainToDelete)
                          .map(t => (
                            <option key={t.name} value={t.name}>{t.name}</option>
                          ))}
                      </select>
                    </div>
                  </label>
                )}

                <label className="flex items-start gap-2 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer bg-gray-50 dark:bg-[#16171d]">
                  <input
                    type="radio"
                    name="domainStrategy"
                    checked={deleteDomainStrategy === 'detach'}
                    onChange={() => setDeleteDomainStrategy('detach')}
                    className="mt-0.5 accent-purple-600"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-gray-800 dark:text-gray-200">Remove category tag from cards</div>
                    <div className="text-gray-400 mt-0.5 text-[11px]">Cards remain intact in library without this category.</div>
                  </div>
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setDomainToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteDomain}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- In-Panel Safe Deletion for Field --- */}
      {fieldToDelete && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#1f2028] w-full max-w-md p-5 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 animate-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-red-500 mb-3">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/50">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                Delete Field "{fieldToDelete.field}"?
              </h4>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
              {(counts.fieldCounts[formatTaxonomyTag(fieldToDelete.domain, fieldToDelete.field)] || 0) > 0 ? (
                <>
                  Currently <strong className="text-purple-600 dark:text-purple-400">{counts.fieldCounts[formatTaxonomyTag(fieldToDelete.domain, fieldToDelete.field)]} cards</strong> are tagged with this field.
                </>
              ) : (
                'Are you sure you want to delete this field? No cards are tagged with it.'
              )}
            </p>

            {(counts.fieldCounts[formatTaxonomyTag(fieldToDelete.domain, fieldToDelete.field)] || 0) > 0 && (
              <div className="space-y-2 mb-4">
                {currentDomainFields.filter(f => f !== fieldToDelete.field).length > 0 && (
                  <label className="flex items-start gap-2 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer bg-gray-50 dark:bg-[#16171d]">
                    <input
                      type="radio"
                      name="fieldStrategy"
                      checked={fieldDeleteStrategy === 'merge'}
                      onChange={() => setFieldDeleteStrategy('merge')}
                      className="mt-0.5 accent-purple-600"
                    />
                    <div className="flex-1 text-xs">
                      <div className="font-bold text-gray-800 dark:text-gray-200">Merge into another field</div>
                      <select
                        value={mergeTargetField}
                        onChange={e => setMergeTargetField(e.target.value)}
                        disabled={fieldDeleteStrategy !== 'merge'}
                        className="mt-1.5 w-full p-1.5 bg-white dark:bg-[#1f2028] border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none"
                      >
                        {currentDomainFields
                          .filter(f => f !== fieldToDelete.field)
                          .map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                      </select>
                    </div>
                  </label>
                )}

                <label className="flex items-start gap-2 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer bg-gray-50 dark:bg-[#16171d]">
                  <input
                    type="radio"
                    name="fieldStrategy"
                    checked={fieldDeleteStrategy === 'detach'}
                    onChange={() => setFieldDeleteStrategy('detach')}
                    className="mt-0.5 accent-purple-600"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-gray-800 dark:text-gray-200">Remove field tag from cards</div>
                    <div className="text-gray-400 mt-0.5 text-[11px]">Cards remain intact in library without this field tag.</div>
                  </div>
                </label>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setFieldToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteField}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- In-Panel Reset Defaults Dialog --- */}
      {confirmResetModal && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#1f2028] w-full max-w-xs p-5 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 text-center animate-in zoom-in-95">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-2.5">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1.5">
              Reset Default Taxonomy?
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Restores the default 10 categories. Existing card tags will not be erased.
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setConfirmResetModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
