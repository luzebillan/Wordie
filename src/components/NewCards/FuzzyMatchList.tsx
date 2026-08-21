import React from 'react';
import { Search, Sparkles, Loader2 } from 'lucide-react';
import type { SimilarityMode } from '../../hooks/useSimilarCards';

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
                className="bg-white dark:bg-[#1f2028] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700/80 cursor-pointer hover:border-purple-300 dark:hover:border-purple-700/60 transition-all flex flex-col overflow-hidden group"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent('preview-card', { detail: card.id }))
                }
              >
                {card.imageUrl && (
                  <div className="w-full h-24 bg-gray-50 dark:bg-[#16171d] border-b border-gray-200 dark:border-gray-700 relative overflow-hidden">
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
                
                <div className="p-3 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm line-clamp-2">
                      {card.front}
                    </h4>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                      {card.type && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded shrink-0 font-medium">
                          {card.type}
                        </span>
                      )}
                      {card.type === 'Useful Expressions' && card.style && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded shrink-0 font-semibold">
                          {card.style}
                        </span>
                      )}
                      {card.type === 'Glossary' && card.label && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded shrink-0 font-semibold max-w-[90px] truncate" title={card.label}>
                          {card.label}
                        </span>
                      )}
                      {card.type === 'Ready Versions' && card.label && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded shrink-0 font-semibold">
                          {card.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-dotted border-gray-200 dark:border-gray-700 w-full" />

                <div className="p-3 pt-2">
                  <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                    {card.back}
                  </p>
                </div>

                <div className="bg-gray-50/80 dark:bg-gray-800/60 px-3 py-1.5 flex items-center justify-between border-t border-gray-100 dark:border-gray-800/80">
                  <span className="text-[11px] font-medium text-gray-400">
                    {(card.repetitions || 0) + (card.manualReviewCount || 0)} Reviews
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onIncrement(card.id);
                    }}
                    className="px-2.5 py-0.5 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-400 text-white rounded text-xs font-bold transition-colors shadow-sm"
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
