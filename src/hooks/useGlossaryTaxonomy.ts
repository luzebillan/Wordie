import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  type TaxonomyItem,
  DEFAULT_TAXONOMY,
  TAXONOMY_MIGRATION_V1_TO_V2,
  parseTaxonomyTag,
  formatTaxonomyTag,
  getStoredTaxonomy,
  saveStoredTaxonomy,
  taxonomyToDomainFields
} from '../constants/domains'

export interface TaxonomyCounts {
  domainCounts: Record<string, number>;
  fieldCounts: Record<string, number>;
  totalGlossaryCards: number;
}

export interface OrphanInfo {
  count: number;
  sampleTerms: string[];
}

export function useGlossaryTaxonomy() {
  const [taxonomy, setTaxonomy] = useState<TaxonomyItem[]>(getStoredTaxonomy)
  const [counts, setCounts] = useState<TaxonomyCounts>({
    domainCounts: {},
    fieldCounts: {},
    totalGlossaryCards: 0
  })
  const [isLoadingCounts, setIsLoadingCounts] = useState(false)
  const [orphans, setOrphans] = useState<Record<string, OrphanInfo>>({})
  const [totalOrphanCards, setTotalOrphanCards] = useState(0)

  const validTaxonomyTags = useMemo(() => {
    const tags: string[] = []
    for (const item of taxonomy) {
      tags.push(item.name)
      for (const field of item.fields) {
        tags.push(formatTaxonomyTag(item.name, field))
      }
    }
    return tags
  }, [taxonomy])

  const refreshCounts = useCallback(async () => {
    if (!window.ipcRenderer?.getTaxonomyCounts) return
    setIsLoadingCounts(true)
    try {
      const res = await window.ipcRenderer.getTaxonomyCounts()
      if (res && res.success) {
        setCounts({
          domainCounts: res.domainCounts || {},
          fieldCounts: res.fieldCounts || {},
          totalGlossaryCards: res.totalGlossaryCards || 0
        })
      }
    } catch (err) {
      console.error('Failed to fetch taxonomy counts', err)
    } finally {
      setIsLoadingCounts(false)
    }
  }, [])

  const scanOrphans = useCallback(async () => {
    if (!window.ipcRenderer?.getOrphanedGlossaryTags) return
    try {
      const res = await window.ipcRenderer.getOrphanedGlossaryTags(validTaxonomyTags)
      if (res && res.success) {
        setOrphans(res.orphans || {})
        setTotalOrphanCards(res.totalOrphanCards || 0)
      }
    } catch (err) {
      console.error('Failed to scan orphaned tags', err)
    }
  }, [validTaxonomyTags])

  // Sync with global events
  useEffect(() => {
    const handleTaxonomyUpdated = () => {
      setTaxonomy(getStoredTaxonomy())
      refreshCounts()
      scanOrphans()
    }

    window.addEventListener('taxonomy-updated', handleTaxonomyUpdated)
    window.addEventListener('stats-updated', refreshCounts)
    refreshCounts()
    scanOrphans()

    return () => {
      window.removeEventListener('taxonomy-updated', handleTaxonomyUpdated)
      window.removeEventListener('stats-updated', refreshCounts)
    }
  }, [refreshCounts, scanOrphans])

  const autoMigrateKnownLegacyTags = useCallback(async (): Promise<{ success: boolean; affectedCount?: number; error?: string }> => {
    if (!window.ipcRenderer?.batchMigrateGlossaryTags) return { success: false, error: 'IPC not available' }
    try {
      const res = await window.ipcRenderer.batchMigrateGlossaryTags(TAXONOMY_MIGRATION_V1_TO_V2)
      if (res && res.success) {
        refreshCounts()
        scanOrphans()
        return { success: true, affectedCount: res.affectedCount }
      }
      return { success: false, error: res?.error }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }, [refreshCounts, scanOrphans])

  // Auto-migration on startup if legacy tags detected
  useEffect(() => {
    const checkAndRunV1Migration = async () => {
      if (window.ipcRenderer?.batchMigrateGlossaryTags) {
        try {
          const res = await window.ipcRenderer.batchMigrateGlossaryTags(TAXONOMY_MIGRATION_V1_TO_V2)
          if (res && res.success && (res.affectedCount || 0) > 0) {
            console.log(`[Taxonomy] Auto-migrated ${res.affectedCount} legacy cards to V2 taxonomy.`)
            refreshCounts()
            scanOrphans()
          }
        } catch (e) {
          console.error('[Taxonomy] V1->V2 migration check failed', e)
        }
      }
    }
    checkAndRunV1Migration()
  }, [refreshCounts, scanOrphans])

  const notifyUpdate = (newTaxonomy: TaxonomyItem[]) => {
    setTaxonomy(newTaxonomy)
    saveStoredTaxonomy(newTaxonomy)
    window.dispatchEvent(new Event('taxonomy-updated'))
    window.dispatchEvent(new Event('stats-updated'))
  }

  const addDomain = useCallback((name: string, initialFields: string[] = []): { success: boolean; error?: string } => {
    const trimmed = name.trim()
    if (!trimmed) return { success: false, error: 'Category name cannot be empty.' }
    if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes(',')) {
      return { success: false, error: 'Category name cannot contain "/", "\\", or ",".' }
    }
    if (taxonomy.some(t => t.name.toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, error: 'A category with this name already exists.' }
    }

    const newItem: TaxonomyItem = {
      id: `domain_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      fields: initialFields.map(f => f.trim()).filter(Boolean),
      isDefault: false
    }

    const updated = [...taxonomy, newItem]
    notifyUpdate(updated)
    return { success: true }
  }, [taxonomy])

  const renameDomain = useCallback(async (oldName: string, newName: string): Promise<{ success: boolean; error?: string }> => {
    const trimmed = newName.trim()
    if (!trimmed) return { success: false, error: 'New category name cannot be empty.' }
    if (trimmed === oldName) return { success: true }
    if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes(',')) {
      return { success: false, error: 'Category name cannot contain "/", "\\", or ",".' }
    }
    if (taxonomy.some(t => t.name.toLowerCase() === trimmed.toLowerCase() && t.name.toLowerCase() !== oldName.toLowerCase())) {
      return { success: false, error: 'A category with this name already exists.' }
    }

    if (window.ipcRenderer?.migrateGlossaryDomain) {
      const res = await window.ipcRenderer.migrateGlossaryDomain({
        oldDomain: oldName,
        action: 'rename',
        newDomainName: trimmed
      })
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to update database cards.' }
      }
    }

    const updated = taxonomy.map(t => {
      if (t.name === oldName) {
        return { ...t, name: trimmed }
      }
      return t
    })

    notifyUpdate(updated)
    return { success: true }
  }, [taxonomy])

  const deleteDomain = useCallback(async (
    domainName: string,
    strategy: 'transfer' | 'uncategorized' | 'detach' = 'detach',
    targetDomain?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cardCount = counts.domainCounts[domainName] || 0

    if (cardCount > 0 && window.ipcRenderer?.migrateGlossaryDomain) {
      const res = await window.ipcRenderer.migrateGlossaryDomain({
        oldDomain: domainName,
        action: strategy,
        targetDomain
      })
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to migrate cards.' }
      }
    }

    const updated = taxonomy.filter(t => t.name !== domainName)
    notifyUpdate(updated)
    return { success: true }
  }, [taxonomy, counts])

  const reorderDomains = useCallback((newTaxonomy: TaxonomyItem[]) => {
    notifyUpdate(newTaxonomy)
  }, [])

  const addField = useCallback((domainName: string, fieldName: string): { success: boolean; error?: string } => {
    const trimmed = fieldName.trim()
    if (!trimmed) return { success: false, error: 'Field name cannot be empty.' }
    if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes(',')) {
      return { success: false, error: 'Field name cannot contain "/", "\\", or ",".' }
    }

    const targetDomain = taxonomy.find(t => t.name === domainName)
    if (!targetDomain) return { success: false, error: 'Domain not found.' }
    if (targetDomain.fields.some(f => f.toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, error: 'This field already exists in the category.' }
    }

    const updated = taxonomy.map(t => {
      if (t.name === domainName) {
        return { ...t, fields: [...t.fields, trimmed] }
      }
      return t
    })

    notifyUpdate(updated)
    return { success: true }
  }, [taxonomy])

  const batchAddFields = useCallback((domainName: string, rawInput: string): { success: boolean; addedCount: number; error?: string } => {
    const candidates = rawInput
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(s => s && !s.includes('/') && !s.includes('\\'))

    if (candidates.length === 0) {
      return { success: false, addedCount: 0, error: 'No valid fields provided.' }
    }

    const targetDomain = taxonomy.find(t => t.name === domainName)
    if (!targetDomain) return { success: false, addedCount: 0, error: 'Domain not found.' }

    const existingLower = new Set(targetDomain.fields.map(f => f.toLowerCase()))
    const uniqueToAdd: string[] = []

    for (const c of candidates) {
      if (!existingLower.has(c.toLowerCase()) && !uniqueToAdd.some(u => u.toLowerCase() === c.toLowerCase())) {
        uniqueToAdd.push(c)
      }
    }

    if (uniqueToAdd.length === 0) {
      return { success: false, addedCount: 0, error: 'All fields already exist.' }
    }

    const updated = taxonomy.map(t => {
      if (t.name === domainName) {
        return { ...t, fields: [...t.fields, ...uniqueToAdd] }
      }
      return t
    })

    notifyUpdate(updated)
    return { success: true, addedCount: uniqueToAdd.length }
  }, [taxonomy])

  const renameField = useCallback(async (
    domainName: string,
    oldFieldName: string,
    newFieldName: string
  ): Promise<{ success: boolean; error?: string }> => {
    const trimmed = newFieldName.trim()
    if (!trimmed) return { success: false, error: 'Field name cannot be empty.' }
    if (trimmed === oldFieldName) return { success: true }
    if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes(',')) {
      return { success: false, error: 'Field name cannot contain "/", "\\", or ",".' }
    }

    const targetDomain = taxonomy.find(t => t.name === domainName)
    if (!targetDomain) return { success: false, error: 'Domain not found.' }
    if (targetDomain.fields.some(f => f.toLowerCase() === trimmed.toLowerCase() && f.toLowerCase() !== oldFieldName.toLowerCase())) {
      return { success: false, error: 'This field already exists in the category.' }
    }

    if (window.ipcRenderer?.migrateGlossaryField) {
      const res = await window.ipcRenderer.migrateGlossaryField({
        domain: domainName,
        oldField: oldFieldName,
        action: 'rename',
        newFieldName: trimmed
      })
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to update database cards.' }
      }
    }

    const updated = taxonomy.map(t => {
      if (t.name === domainName) {
        return {
          ...t,
          fields: t.fields.map(f => (f === oldFieldName ? trimmed : f))
        }
      }
      return t
    })

    notifyUpdate(updated)
    return { success: true }
  }, [taxonomy])

  const deleteField = useCallback(async (
    domainName: string,
    fieldName: string,
    mergeTargetField?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const fieldKey = formatTaxonomyTag(domainName, fieldName)
    const cardCount = counts.fieldCounts[fieldKey] || 0

    if (cardCount > 0 && window.ipcRenderer?.migrateGlossaryField) {
      const res = await window.ipcRenderer.migrateGlossaryField({
        domain: domainName,
        oldField: fieldName,
        action: mergeTargetField ? 'merge' : 'detach',
        mergeTargetField
      })
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to migrate cards.' }
      }
    }

    const updated = taxonomy.map(t => {
      if (t.name === domainName) {
        return {
          ...t,
          fields: t.fields.filter(f => f !== fieldName)
        }
      }
      return t
    })

    notifyUpdate(updated)
    return { success: true }
  }, [taxonomy, counts])

  const resetToDefault = useCallback(() => {
    notifyUpdate(DEFAULT_TAXONOMY)
  }, [])

  // --- Orphan Management (Taxonomy Doctor) ---
  const adoptOrphanTag = useCallback((rawTag: string): { success: boolean; error?: string } => {
    if (!rawTag.trim()) return { success: false }
    const { domain: domainName, field: fieldName } = parseTaxonomyTag(rawTag)
    let nextTaxonomy = [...taxonomy]

    if (fieldName) {
      const existingDomain = nextTaxonomy.find(t => t.name.toLowerCase() === domainName.toLowerCase())
      if (existingDomain) {
        if (!existingDomain.fields.some(f => f.toLowerCase() === fieldName.toLowerCase())) {
          nextTaxonomy = nextTaxonomy.map(t => t.id === existingDomain.id ? { ...t, fields: [...t.fields, fieldName] } : t)
        }
      } else {
        nextTaxonomy.push({
          id: `domain_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: domainName,
          fields: [fieldName],
          isDefault: false
        })
      }
    } else {
      if (!nextTaxonomy.some(t => t.name.toLowerCase() === domainName.toLowerCase())) {
        nextTaxonomy.push({
          id: `domain_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: domainName,
          fields: [],
          isDefault: false
        })
      }
    }

    notifyUpdate(nextTaxonomy)
    return { success: true }
  }, [taxonomy])

  const adoptAllOrphans = useCallback((): { success: boolean; count: number } => {
    const orphanTags = Object.keys(orphans)
    if (orphanTags.length === 0) return { success: true, count: 0 }

    let nextTaxonomy = [...taxonomy]
    for (const rawTag of orphanTags) {
      const { domain: domainName, field: fieldName } = parseTaxonomyTag(rawTag)
      if (fieldName) {
        const existingDomain = nextTaxonomy.find(t => t.name.toLowerCase() === domainName.toLowerCase())
        if (existingDomain) {
          if (!existingDomain.fields.some(f => f.toLowerCase() === fieldName.toLowerCase())) {
            nextTaxonomy = nextTaxonomy.map(t => t.id === existingDomain.id ? { ...t, fields: [...t.fields, fieldName] } : t)
          }
        } else {
          nextTaxonomy.push({
            id: `domain_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: domainName,
            fields: [fieldName],
            isDefault: false
          })
        }
      } else {
        if (!nextTaxonomy.some(t => t.name.toLowerCase() === domainName.toLowerCase())) {
          nextTaxonomy.push({
            id: `domain_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: domainName,
            fields: [],
            isDefault: false
          })
        }
      }
    }

    notifyUpdate(nextTaxonomy)
    return { success: true, count: orphanTags.length }
  }, [taxonomy, orphans])

  const remapOrphanTag = useCallback(async (oldTag: string, newTag: string | null): Promise<{ success: boolean; error?: string }> => {
    if (!window.ipcRenderer?.batchMigrateGlossaryTags) return { success: false, error: 'IPC not available' }
    try {
      const res = await window.ipcRenderer.batchMigrateGlossaryTags({ [oldTag]: newTag })
      if (res && res.success) {
        refreshCounts()
        scanOrphans()
        return { success: true }
      }
      return { success: false, error: res?.error }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }, [refreshCounts, scanOrphans])

  return {
    taxonomy,
    domains: taxonomy.map(t => t.name),
    domainFields: taxonomyToDomainFields(taxonomy),
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
  }
}
