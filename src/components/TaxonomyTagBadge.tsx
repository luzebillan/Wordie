import React from 'react'
import { ChevronRight, X } from 'lucide-react'
import { parseTaxonomyTag } from '../constants/domains'

interface TaxonomyTagBadgeProps {
  label: string
  size?: 'xs' | 'sm' | 'md'
  onRemove?: () => void
  onClick?: () => void
  className?: string
  clickable?: boolean
}

export const TaxonomyTagBadge: React.FC<TaxonomyTagBadgeProps> = ({
  label,
  size = 'xs',
  onRemove,
  onClick,
  className = '',
  clickable = false
}) => {
  if (!label) return null

  // If label contains comma-separated tags, render multiple badges
  if (label.includes(',')) {
    const parts = label.split(',').map(s => s.trim()).filter(Boolean)
    return (
      <div className="inline-flex flex-wrap gap-1 items-center">
        {parts.map(p => (
          <TaxonomyTagBadge
            key={p}
            label={p}
            size={size}
            onClick={onClick}
            clickable={clickable}
            className={className}
          />
        ))}
      </div>
    )
  }

  const { domain, field } = parseTaxonomyTag(label)

  const sizeClasses = {
    xs: 'text-[9px] px-2 py-0.5 rounded-md gap-1',
    sm: 'text-[10px] px-2.5 py-1 rounded-lg gap-1.5',
    md: 'text-xs px-3 py-1.5 rounded-xl gap-2'
  }[size]

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center font-medium bg-purple-50/80 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 border border-purple-200/60 dark:border-purple-800/50 shadow-xs transition-all ${sizeClasses} ${
        clickable ? 'cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/60 hover:border-purple-300' : ''
      } ${className}`}
      title={label}
    >
      <span className="font-semibold tracking-wide">{domain}</span>
      {field && (
        <>
          <ChevronRight className="w-2.5 h-2.5 opacity-40 shrink-0 text-purple-600 dark:text-purple-300" />
          <span className="font-bold text-purple-900 dark:text-purple-100">{field}</span>
        </>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 p-0.5 text-purple-400 hover:text-purple-700 dark:hover:text-purple-100 rounded hover:bg-purple-200/50 transition-colors"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  )
}
