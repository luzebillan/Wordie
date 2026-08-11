import React from 'react';

interface FuzzyMatchListProps {
  similarCards: any[];
  emptyMessage: string;
  onIncrement: (id: number) => void;
  onNavigate?: (view: string, props?: any) => void;
  toastMessage?: string;
}

export const FuzzyMatchList: React.FC<FuzzyMatchListProps> = ({
  similarCards,
  emptyMessage,
  onIncrement,
  onNavigate,
  toastMessage,
}) => {
  return (
    <div className="w-80 bg-gray-100/50 dark:bg-[#16171d] rounded-2xl p-6 flex flex-col items-center justify-center border border-gray-200 dark:border-gray-800">
      {similarCards.length === 0 ? (
        <div className="text-center opacity-50 flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <p className="text-lg font-medium">{emptyMessage}</p>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Similar Cards</h3>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {similarCards.map((card) => (
              <div 
                key={card.id} 
                className="bg-white dark:bg-[#1f2028] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors flex flex-col overflow-hidden"
                onClick={() => window.dispatchEvent(new CustomEvent('preview-card', { detail: card.id }))}
              >
                {card.imageUrl && (
                  <div className="w-full h-28 bg-gray-50 dark:bg-[#16171d] border-b border-gray-200 dark:border-gray-700 relative overflow-hidden">
                    <img 
                      src={card.imageUrl.startsWith('http') ? card.imageUrl : `local-asset://${card.imageUrl}`} 
                      alt="Card Preview" 
                      className="absolute inset-0 w-full h-full object-contain p-1" 
                    />
                  </div>
                )}
                <div className="p-4 pb-3">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">{card.front}</h4>
                </div>
                
                <div className="border-t border-dotted border-gray-200 dark:border-gray-700 w-full" />
                
                <div className="p-4 pt-3">
                  <p className="text-sm text-gray-800 dark:text-gray-300 line-clamp-2">
                    {card.back}
                  </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800/80 px-4 py-2 flex items-center gap-2">
                  <span className="text-xs text-gray-400">{(card.repetitions || 0) + (card.manualReviewCount || 0)} Reviews</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onIncrement(card.id);
                    }}
                    className="px-2 py-0.5 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-400 monochrome:bg-gray-600 monochrome:hover:bg-gray-700 dark:monochrome:bg-gray-700 dark:monochrome:hover:bg-gray-600 text-white rounded text-xs font-bold transition-colors shadow-sm"
                  >
                    +1
                  </button>
                </div>
              </div>
            ))}
          </div>
          {toastMessage && (
            <div className="mt-4 p-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-bold rounded-lg text-center animate-in slide-in-from-bottom-2 fade-in">
              {toastMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
