import React from 'react';
import { Search, Sparkles, Loader2 } from 'lucide-react';
import type { SimilarityMode } from '../../hooks/useSimilarCards';
import { TaxonomyTagBadge } from '../TaxonomyTagBadge';

interface FuzzyMatchListProps {
  similarCards: any[];
  mode?: SimilarityMode;
  isSearching?: boolean;
  isAnalyzing?: boolean;
  emptyMessage?: string;
  onIncrement: (id: number) => void;
  onNavigate?: (view: string, props?: any) => void;
  toastMessage?: string;
}

export const FuzzyMatchList: React.FC<FuzzyMatchListProps> = ({
  similarCards,
  mode = 'search',
  isSearching = false,
  isAnalyzing = false,
  emptyMessage = 'No Matching Cards Found',
  onIncrement,
  toastMessage,
}) => {
  const isSemantic = mode === 'semantic';

  return (
    <div className="w-80 bg-gray-100/50 dark:bg-[#16171d] rounded-2xl p-5 flex flex-col border border-gray-200 dark:border-gray-800 transition-all duration-300">
      {/* Panel Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200/80 dark:border-gray-800/80">
        <div className="flex items-center gap-2">
          {isSemantic ? (
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          ) : (
            <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          )}
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {isSemantic ? 'Similar Cards' : 'Matching Cards'}
          </h3>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
            isSemantic
              ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50'
              : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
          }`}
        >
          {isSemantic ? 'AI Semantic' : 'Local Search'}
        </span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Loading State: Semantic Analysis */}
        {isAnalyzing ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin mb-3" />
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Analyzing Semantics...</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Running Transformer & AI synonym filter
            </p>
          </div>
        ) : isSearching ? (
          /* Loading State: Real-time Search */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin mb-2" />
            <p className="text-xs font-medium text-gray-400">Searching local cards...</p>
          </div>
        ) : similarCards.length === 0 ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60 p-4">
            {isSemantic ? (
              <Sparkles className="w-10 h-10 mb-3 text-purple-400 stroke-1" />
            ) : (
              <Search className="w-10 h-10 mb-3 text-gray-400 stroke-1" />
            )}
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{emptyMessage}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {isSemantic
                ? 'No strict synonyms found for this expression'
                : 'Cards with matching terms will show here in real-time'}
            </p>
          </div>
        ) : (
          /* Cards List */
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {similarCards.map((card) => (
              <div
                key={card.id}
                className="bg-white dark:bg-[#1f2028] rounded-xl shadow-2xs border border-gray-200 dark:border-gray-700/80 cursor-pointer hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-md transition-all flex flex-col p-3.5 gap-2 group"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent('preview-card', { detail: card.id }))
                }
              >
                {card.imageUrl && (
                  <div className="w-full h-24 bg-gray-50 dark:bg-[#16171d] rounded-lg border border-gray-100 dark:border-gray-800 relative overflow-hidden shrink-0">
                    <img
                      src={
                        card.imageUrl.startsWith('http')
                          ? card.imageUrl
                          : `local-asset://${card.imageUrl}`
                      }
                      alt="Card Preview"
                      className="absolute inset-0 w-full h-full object-contain p-1"
                    />
                  </div>
                )}
                
                {/* Metadata Row: Badges & Tags */}
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 overflow-hidden flex-wrap flex-1 min-w-0">
                    {card.type && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded shrink-0 font-medium select-none">
                        {card.type}
                      </span>
                    )}
                    {card.type === 'Useful Expressions' && card.style && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded shrink-0 font-semibold truncate max-w-[90px]"
                        title={card.style}
                      >
                        {card.style}
                      </span>
                    )}
                    {card.type === 'Glossary' && card.label && (
                      <TaxonomyTagBadge label={card.label} size="xs" maxTags={1} compact />
                    )}
                    {card.type === 'Ready Versions' && card.label && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded shrink-0 font-semibold truncate max-w-[90px]"
                        title={card.label}
                      >
                        {card.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Front Side: Term / Title (Full Width) */}
                <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-snug line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {card.front || <span className="text-gray-400 font-normal italic">No front text</span>}
                </h4>

                {/* Source Context (if present) */}
                {card.sourceContext && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 italic line-clamp-1 border-l-2 border-purple-300 dark:border-purple-800 pl-1.5">
                    “{card.sourceContext}”
                  </p>
                )}

                {/* Back Side: Definition / Explanation (3-4 lines readable area) */}
                {card.back && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-4 select-text">
                    {card.back}
                  </p>
                )}

                {/* Card Footer: Review count & Quick review button */}
                <div className="pt-2 mt-0.5 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 select-none">
                    {(card.repetitions || 0) + (card.manualReviewCount || 0)} Reviews
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onIncrement(card.id);
                    }}
                    className="px-2 py-0.5 bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white dark:bg-purple-950/50 dark:hover:bg-purple-600 dark:text-purple-300 dark:hover:text-white rounded-md text-xs font-bold transition-all border border-purple-200/80 dark:border-purple-800/80 shadow-2xs"
                    title="Increment review count (+1)"
                  >
                    +1
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Local Toast Feedback */}
        {toastMessage && (
          <div className="mt-2 p-2 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-xs font-bold rounded-lg text-center animate-in slide-in-from-bottom-2 fade-in">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
};
