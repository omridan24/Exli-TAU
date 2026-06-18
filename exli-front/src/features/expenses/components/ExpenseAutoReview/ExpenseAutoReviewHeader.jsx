import React from "react";
import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";

export const ExpenseAutoReviewHeader = ({
  activeCount,
  totalAmount,
  unmatchedCount,
  t,
}) => {
  return (
    <div className="mb-8 lg:pr-80">
      <h2 className="text-3xl font-black text-slate-800 mb-6">
        {t("expenses.auto.reviewTitle")}
      </h2>
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-100 flex-1 min-w-[120px]">
          <div className="text-xs font-bold text-slate-400 mb-1">
            {t("expenses.auto.summaryTotal", { count: activeCount })}
          </div>
          <div className="text-xl font-black text-slate-700">
            {totalAmount} <span className="text-xs">ILS</span>
          </div>
        </div>
        <div className="bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 flex-1 min-w-[120px]">
          <div className="text-xs font-bold text-emerald-600 mb-1">
            {t("expenses.auto.summaryCategorized", {
              count: activeCount - unmatchedCount,
            })}
          </div>
          <div className="text-xl font-black text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
        <div
          className={`px-4 py-3 rounded-xl border flex-1 min-w-[120px] ${unmatchedCount > 0 ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}
        >
          <div
            className={`text-xs font-bold mb-1 ${unmatchedCount > 0 ? "text-red-600" : "text-slate-400"}`}
          >
            {t("expenses.auto.summaryNeedAttention", {
              count: unmatchedCount,
            })}
          </div>
          <div
            className={`text-xl font-black flex items-center gap-2 ${unmatchedCount > 0 ? "text-red-700" : "text-slate-500"}`}
          >
            {unmatchedCount > 0 && (
              <AlertCircle className="w-5 h-5 animate-pulse" />
            )}
            {unmatchedCount}
          </div>
        </div>
      </div>
      <div className="bg-blue-50 text-blue-700 p-3 rounded-xl font-bold flex items-center gap-2 shadow-sm mb-4 border border-blue-100 text-sm">
        <HelpCircle className="w-4 h-4 flex-shrink-0" />
        {t(
          "expenses.auto.aiDisclaimer",
          "AI categorizations are suggestions and may contain errors. Please review them carefully.",
        )}
      </div>
      {unmatchedCount > 0 ? (
        <div className="bg-red-500 text-white p-3 rounded-xl font-bold flex items-center gap-2 shadow-sm text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {t("expenses.auto.needAttentionAlert", { count: unmatchedCount })}
        </div>
      ) : activeCount > 0 ? (
        <div className="bg-emerald-500 text-white p-3 rounded-xl font-bold flex items-center gap-2 shadow-sm text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {t("expenses.auto.allCategorized")}
        </div>
      ) : null}
    </div>
  );
};
