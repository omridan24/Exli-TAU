import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "../../../../components/UI.jsx";
import { CloseConfirmationModal } from "../../../../components/CloseConfirmationModal.jsx";
import { DEFAULT_CATEGORIES } from "../../../../config/constants";
import { Pagination } from "../../../../components/Pagination.jsx";
import { ExpenseAutoReviewHeader } from "./ExpenseAutoReviewHeader.jsx";
import { ExpenseAutoReviewRow } from "./ExpenseAutoReviewRow.jsx";

export const ExpenseAutoReview = ({
  data,
  summary,
  categories = DEFAULT_CATEGORIES,
  isLoading,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState(data);

  const [openPickerId, setOpenPickerId] = useState(null);
  const [activeTxIndex, setActiveTxIndex] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [showOnlyUncategorized, setShowOnlyUncategorized] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
    if (activeTxIndex !== null) {
      const tx = transactions[activeTxIndex];
      if (!tx) {
        setActiveTxIndex(null);
      }
    }
  }, [activeTxIndex, transactions]);

  const activeTransactions = transactions.filter(tx => !tx._deleted);
  const activeCount = activeTransactions.length;
  const unmatchedCount = activeTransactions.filter(
    (tx) => !tx.assignedCategory,
  ).length;

  const totalAmount = useMemo(() => {
    return activeTransactions
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
      .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [activeTransactions]);

  const filteredTransactionsCount = showOnlyUncategorized ? unmatchedCount : activeCount;
  const totalPages = Math.ceil(filteredTransactionsCount / itemsPerPage) || 1;

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentTransactions = useMemo(() => {
    const withIndices = transactions.map((tx, idx) => ({ ...tx, _originalIndex: idx }));
    const activeWithIndices = withIndices.filter(tx => !tx._deleted);
    const filteredWithIndices = activeWithIndices.filter(tx => 
      showOnlyUncategorized ? !tx.assignedCategory : true
    );
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredWithIndices.slice(startIdx, startIdx + itemsPerPage);
  }, [transactions, currentPage, itemsPerPage, showOnlyUncategorized]);

  const groupedTransactions = useMemo(() => {
    const groups = {};
    currentTransactions.forEach((tx) => {
      const month = tx.reportMonth || "Unknown";
      if (!groups[month]) groups[month] = [];
      groups[month].push(tx);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [currentTransactions]);

  const isReadyToSave = unmatchedCount === 0 && activeCount > 0 && !isLoading;

  const handleCategorySelect = (index, categoryId) => {
    const newTxs = [...transactions];
    newTxs[index].assignedCategory = categoryId;
    newTxs[index].matched = true;
    setTransactions(newTxs);
    setOpenPickerId(null);
  };

  const getCategoryDetails = (catId) => {
    return (
      categories.find((c) => c.id === catId || c.name === catId) ||
      DEFAULT_CATEGORIES.find((c) => c.id === catId || c.name === catId) ||
      DEFAULT_CATEGORIES.find((c) => c.id === "other")
    );
  };

  const handleSave = () => {
    const finalTxs = transactions.filter((tx) => !tx._deleted);
    onSave(finalTxs);
  };

  return (
    <div className="w-full mx-auto pb-32 animate-fade-in">
      <ExpenseAutoReviewHeader
        activeCount={activeCount}
        totalAmount={totalAmount}
        unmatchedCount={unmatchedCount}
        t={t}
      />

      <div className="flex items-center gap-2 mb-6 px-2">
        <input 
          type="checkbox" 
          id="showUncategorizedToggle"
          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
          checked={showOnlyUncategorized}
          onChange={(e) => {
            setShowOnlyUncategorized(e.target.checked);
            setCurrentPage(1);
          }}
        />
        <label htmlFor="showUncategorizedToggle" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
          {t("expenses.auto.showOnlyUncategorized", "Show only uncategorized")}
        </label>
      </div>

      {/* Expense list */}
      <div className="space-y-8 w-full">
        {groupedTransactions.map(([month, txs]) => (
          <div key={month} className="space-y-4">
            <h3 className="text-xl font-black text-slate-800 border-b-2 border-slate-100 pb-2">
              {t("expenses.auto.monthGroup", { month })}
            </h3>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
              <div className="hidden lg:grid lg:grid-cols-[100px_minmax(250px,3fr)_minmax(200px,2fr)_minmax(150px,2fr)_120px] w-full gap-4 px-4 py-3 bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-400 uppercase tracking-widest items-center rounded-t-2xl">
                <div>{t("expenses.columnFields.date")}</div>
                <div>{t("expenses.columnFields.description")}</div>
                <div>{t("expenses.columnFields.category")}</div>
                <div>{t("expenses.columnFields.source", "Source")}</div>
                <div className="text-right">{t("expenses.columnFields.amount")}</div>
              </div>
              <div className="flex flex-col divide-y divide-slate-100 [&>div:last-child]:rounded-b-2xl [&>div:first-child]:rounded-t-2xl lg:[&>div:first-child]:rounded-t-none">
                {txs.map((tx) => {
                  const isUnmatched = !tx.assignedCategory;
                  const isPickerOpen = openPickerId === tx._originalIndex;
                  const isActive = activeTxIndex === tx._originalIndex;
                  const catDetails = tx.assignedCategory
                    ? getCategoryDetails(tx.assignedCategory)
                    : null;

                  return (
                    <ExpenseAutoReviewRow
                      key={tx._originalIndex}
                      tx={tx}
                      isActive={isActive}
                      isPickerOpen={isPickerOpen}
                      isUnmatched={isUnmatched}
                      catDetails={catDetails}
                      categories={categories}
                      t={t}
                      onRowClick={() => {
                        if (!isPickerOpen) setActiveTxIndex(tx._originalIndex);
                      }}
                      onPickerOpen={(e) => {
                        e.stopPropagation();
                        setOpenPickerId(tx._originalIndex);
                        setActiveTxIndex(tx._originalIndex);
                      }}
                      onPickerClose={(e) => {
                        e.stopPropagation();
                        setOpenPickerId(null);
                      }}
                      onCategorySelect={(catId) =>
                        handleCategorySelect(tx._originalIndex, catId)
                      }
                      onSaveInlineEdit={(updates) => {
                        const newTxs = [...transactions];
                        newTxs[tx._originalIndex] = { ...newTxs[tx._originalIndex], ...updates };
                        if (updates.assignedCategory) {
                          newTxs[tx._originalIndex].matched = true;
                        }
                        setTransactions(newTxs);
                      }}
                      onDeleteInlineEdit={() => {
                        const newTxs = [...transactions];
                        newTxs[tx._originalIndex]._deleted = true;
                        setTransactions(newTxs);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {filteredTransactionsCount === 0 && (
          <div className="text-center py-12 text-slate-400">
            {t("expenses.auto.noTransactions", "No transactions to display.")}
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        totalItems={filteredTransactionsCount}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(newVal) => {
          setItemsPerPage(newVal);
          setCurrentPage(1);
        }}
      />

      {isCancelModalOpen && (
        <CloseConfirmationModal
          onContinue={() => setIsCancelModalOpen(false)}
          onDiscard={onCancel}
        />
      )}

      {/* Floating bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-slate-200 z-40 flex justify-center gap-4">
        <Button
          variant="ghost"
          onClick={() => setIsCancelModalOpen(true)}
          className="bg-slate-100"
          disabled={isLoading}
        >
          {t("common.cancel")}
        </Button>
        <Button
          variant="primary"
          disabled={!isReadyToSave}
          onClick={handleSave}
          className={
            isReadyToSave
              ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30 text-white min-w-[200px]"
              : "min-w-[200px]"
          }
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Saving...
            </div>
          ) : (
            t("expenses.auto.approveAndSave")
          )}
        </Button>
      </div>
    </div>
  );
};
