import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './UI.jsx';

export const Pagination = ({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [20, 50, 100]
}) => {
  const { t } = useTranslation();

  if (totalPages <= 1 && totalItems <= Math.min(...itemsPerPageOptions)) return null;

  const handlePrev = () => onPageChange(Math.max(currentPage - 1, 1));
  const handleNext = () => onPageChange(Math.min(currentPage + 1, totalPages));

  const startItem = totalItems === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex items-center justify-between bg-white px-4 py-3 border-t border-slate-200 sm:px-6 mt-4 rounded-xl shadow-sm">
      <div className="flex flex-1 justify-between sm:hidden">
        <Button
          variant="ghost"
          onClick={handlePrev}
          disabled={currentPage === 1}
        >
          {t("common.previous", "Previous")}
        </Button>
        <Button
          variant="ghost"
          onClick={handleNext}
          disabled={currentPage === totalPages || totalPages === 0}
        >
          {t("common.next", "Next")}
        </Button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <p className="text-sm text-slate-700">
            Showing <span className="font-medium">{startItem}</span> to <span className="font-medium">{endItem}</span> of <span className="font-medium">{totalItems}</span> results
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="itemsPerPage" className="text-sm text-slate-500">Per page:</label>
            <select
              id="itemsPerPage"
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="text-sm border-slate-300 rounded-md py-1 pl-2 pr-8 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            >
              {itemsPerPageOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              onClick={handlePrev}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <span className="sr-only">Previous</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              </svg>
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => onPageChange(i + 1)}
                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0 ${
                  currentPage === i + 1
                    ? 'z-10 bg-emerald-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600'
                    : 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages || totalPages === 0}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <span className="sr-only">Next</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};
