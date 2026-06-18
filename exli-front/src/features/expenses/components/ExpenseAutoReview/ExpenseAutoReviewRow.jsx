import React, { useState, useEffect } from "react";
import {
  CreditCard,
  AlertCircle,
  ChevronDown,
  X,
  Flag,
  Edit2,
  Check,
  Trash2
} from "lucide-react";
import { CategoryIcon } from "../../../../components/UI.jsx";
import { DEFAULT_CATEGORIES, CURRENCIES } from "../../../../config/constants";

const cleanDateDisplay = (isoString) => {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return d
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      })
      .replace(/\//g, ".");
  } catch {
    return isoString.split("T")[0];
  }
};

const getCategoryDetailsLocal = (catId, cats) => {
  return (
    cats.find((c) => c.id === catId || c.name === catId) ||
    DEFAULT_CATEGORIES.find((c) => c.id === catId || c.name === catId) ||
    DEFAULT_CATEGORIES.find((c) => c.id === "other")
  );
};

export const ExpenseAutoReviewRow = ({
  tx,
  isActive,
  isPickerOpen,
  isUnmatched,
  catDetails,
  categories,
  t,
  onRowClick,
  onPickerOpen,
  onPickerClose,
  onCategorySelect,
  onSaveInlineEdit,
  onDeleteInlineEdit,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    date: tx.date || "",
    description: tx.description || "",
    amount: tx.amount || "",
    currency: tx.currency || "",
    assignedCategory: tx.assignedCategory || "",
  });
  const [editCatPickerOpen, setEditCatPickerOpen] = useState(false);
  const [editCurrencyPickerOpen, setEditCurrencyPickerOpen] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setEditForm({
        date: tx.date || "",
        description: tx.description || "",
        amount: tx.amount || "",
        currency: tx.currency || "",
        assignedCategory: tx.assignedCategory || "",
      });
      setEditCatPickerOpen(false);
      setEditCurrencyPickerOpen(false);
    }
  }, [tx, isEditing]);

  const handleSave = (e) => {
    e.stopPropagation();
    if (onSaveInlineEdit) {
      onSaveInlineEdit({
        date: editForm.date,
        description: editForm.description,
        amount: parseFloat(editForm.amount) || 0,
        currency: editForm.currency,
        assignedCategory: editForm.assignedCategory,
      });
    }
    setIsEditing(false);
  };

  const handleCancel = (e) => {
    e.stopPropagation();
    setIsEditing(false);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDeleteInlineEdit) {
      onDeleteInlineEdit();
    }
    setIsEditing(false);
  };

  if (isEditing) {
    const editCatDetails = editForm.assignedCategory
      ? getCategoryDetailsLocal(editForm.assignedCategory, categories)
      : null;

    return (
      <div className="flex flex-col lg:grid lg:grid-cols-[140px_minmax(200px,3fr)_minmax(180px,2fr)_minmax(150px,2fr)_140px] w-full lg:items-center p-4 gap-3 lg:gap-4 transition-all bg-blue-50/80 outline outline-2 outline-blue-500 -outline-offset-2 z-20 relative rounded-xl shadow-md my-1">
        {/* Date Input */}
        <input
          type="date"
          value={editForm.date ? new Date(editForm.date).toISOString().slice(0, 10) : ""}
          onChange={(e) => {
            const val = e.target.value;
            setEditForm({
              ...editForm,
              date: val ? new Date(val).toISOString() : ""
            });
          }}
          className="p-2 bg-white rounded-lg border border-blue-200 text-xs font-bold text-slate-700 w-full focus:ring-2 focus:ring-blue-500 outline-none"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Description Input */}
        <input
          type="text"
          value={editForm.description}
          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          className="p-2 bg-white rounded-lg border border-blue-200 text-sm font-bold text-slate-700 w-full focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder={t("expenses.columnFields.description")}
          onClick={(e) => e.stopPropagation()}
        />

        {/* Category Input (Dropdown) */}
        <div className="relative min-w-0" onClick={(e) => e.stopPropagation()}>
          {!editCatPickerOpen ? (
            <button
              onClick={() => setEditCatPickerOpen(true)}
              className={`w-full flex items-center justify-between p-2 rounded-xl border transition-colors ${
                !editForm.assignedCategory
                  ? "bg-white border-red-300 text-red-600 hover:bg-red-50"
                  : "bg-white border-blue-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {!editForm.assignedCategory ? (
                <span className="font-bold text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {t("expenses.auto.selectCategory")}
                </span>
              ) : (
                <div className="flex items-center gap-2 overflow-hidden">
                  <CategoryIcon
                    iconName={editCatDetails?.icon}
                    color={editCatDetails?.color}
                    className="w-5 h-5 flex-shrink-0"
                  />
                  <span className="font-bold text-xs truncate">
                    {editCatDetails
                      ? editCatDetails.id === editCatDetails.name
                        ? editCatDetails.name
                        : t(`categories.${editCatDetails.id}`)
                      : ""}
                  </span>
                </div>
              )}
              <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0 ml-1" />
            </button>
          ) : (
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xl absolute z-50 w-full sm:w-72 top-full left-0 mt-2">
              <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-xs font-bold text-slate-500">
                  {t("expenses.auto.selectCategory")}
                </span>
                <button
                  onClick={() => setEditCatPickerOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-full"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1 max-h-60 overflow-y-auto p-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditForm({ ...editForm, assignedCategory: cat.id });
                      setEditCatPickerOpen(false);
                    }}
                    className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all gap-1"
                  >
                    <CategoryIcon
                      iconName={cat.icon}
                      color={cat.color}
                      className="w-5 h-5"
                    />
                    <span className="text-[9px] font-bold text-slate-600 text-center leading-tight w-full truncate">
                      {cat.id === cat.name ? cat.name : t(`categories.${cat.id}`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Amount & Currency Input */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            value={editForm.amount}
            onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
            className="p-2 bg-white rounded-lg border border-blue-200 text-sm font-bold text-slate-700 w-full min-w-[70px] focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={t("expenses.columnFields.amount")}
            onClick={(e) => e.stopPropagation()}
          />
          
          <div className="relative min-w-[70px]" onClick={(e) => e.stopPropagation()}>
            {!editCurrencyPickerOpen ? (
              <button
                onClick={() => setEditCurrencyPickerOpen(true)}
                className="w-full flex items-center justify-center p-2 rounded-lg border border-blue-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors uppercase h-full min-h-[38px]"
              >
                {editForm.currency || "---"}
                <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0 ml-1" />
              </button>
            ) : (
              <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-xl absolute z-50 w-full sm:w-28 top-full right-0 mt-2 flex flex-col max-h-48 overflow-y-auto">
                <div className="flex justify-between items-center mb-1 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Cur
                  </span>
                  <button
                    onClick={() => setEditCurrencyPickerOpen(false)}
                    className="p-1 hover:bg-slate-100 rounded-full"
                  >
                    <X className="w-3 h-3 text-slate-500" />
                  </button>
                </div>
                {CURRENCIES.map((currency) => (
                  <button
                    key={currency}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditForm({ ...editForm, currency });
                      setEditCurrencyPickerOpen(false);
                    }}
                    className={`p-2 text-xs font-bold rounded-lg text-center transition-colors ${
                      editForm.currency === currency
                        ? "bg-blue-50 text-blue-600"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {currency}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1 lg:gap-2 mt-2 lg:mt-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={handleDelete} className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors flex items-center gap-1" title={t("common.delete", "Delete")}>
            <Trash2 className="w-5 h-5" />
          </button>
          <button onClick={handleCancel} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors flex items-center gap-1">
            <X className="w-5 h-5" />
          </button>
          <button onClick={handleSave} className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 rounded-full transition-colors flex items-center gap-1">
            <Check className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onRowClick}
      className={`group flex flex-col lg:grid lg:grid-cols-[100px_minmax(250px,3fr)_minmax(200px,2fr)_minmax(150px,2fr)_120px] w-full lg:items-center p-4 gap-3 lg:gap-4 transition-all cursor-pointer ${
        isActive
          ? "bg-blue-50/50 outline outline-2 outline-blue-500 -outline-offset-2 z-10 relative"
          : tx.isSuspect
            ? "bg-orange-50/50 hover:bg-orange-100/50"
            : isUnmatched
              ? "bg-red-50/50 hover:bg-red-100/50"
              : "hover:bg-slate-50"
      }`}
    >
      {/* Mobile Top Row / Desktop Date */}
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase whitespace-nowrap">
          {cleanDateDisplay(tx.date)}
        </span>
        {/* Mobile Amount & Edit */}
        <div className="lg:hidden flex items-center gap-3">
          <div className="font-mono font-black text-slate-700">
            {tx.amount}{" "}
            <span className="text-xs text-slate-400">{tx.currency}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="min-w-0">
        <div className="font-bold text-slate-800 text-sm leading-tight mb-1 truncate">
          {tx.description}
        </div>
        {tx.originalCategory && (
          <div className="text-[10px] text-slate-400 truncate">
            {t("expenses.auto.cardOriginal", {
              category: tx.originalCategory,
            })}
          </div>
        )}
      </div>

      {/* Category */}
      <div
        className="relative min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        {!isPickerOpen ? (
          <button
            onClick={onPickerOpen}
            className={`w-full flex items-center justify-between p-2 rounded-xl border transition-colors ${
              isUnmatched
                ? "bg-transparent border-transparent text-red-600 hover:bg-red-50"
                : "bg-transparent border-transparent text-slate-700 hover:bg-slate-50"
            }`}
          >
            {isUnmatched ? (
              <span className="font-bold text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {t("expenses.auto.selectCategory")}
              </span>
            ) : (
              <div className="flex items-center gap-2 overflow-hidden">
                <CategoryIcon
                  iconName={catDetails?.icon}
                  color={catDetails?.color}
                  className="w-5 h-5 flex-shrink-0"
                />
                <span className="font-bold text-xs truncate">
                  {catDetails
                    ? catDetails.id === catDetails.name
                      ? catDetails.name
                      : t(`categories.${catDetails.id}`)
                    : ""}
                </span>
              </div>
            )}
            <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0 ml-1" />
          </button>
        ) : (
          <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xl absolute z-50 w-full sm:w-72 top-full right-0 lg:right-auto lg:left-0 mt-2">
            <div className="flex justify-between items-center mb-2 px-1">
              <span className="text-xs font-bold text-slate-500">
                {t("expenses.auto.selectCategory")}
              </span>
              <button
                onClick={onPickerClose}
                className="p-1 hover:bg-slate-100 rounded-full"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 max-h-60 overflow-y-auto p-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCategorySelect(cat.id);
                  }}
                  className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all gap-1"
                >
                  <CategoryIcon
                    iconName={cat.icon}
                    color={cat.color}
                    className="w-5 h-5"
                  />
                  <span className="text-[9px] font-bold text-slate-600 text-center leading-tight w-full truncate">
                    {cat.id === cat.name
                      ? cat.name
                      : t(`categories.${cat.id}`)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Source & Tags */}
      <div className="flex flex-wrap lg:flex-col gap-2 lg:gap-1 items-center lg:items-start">
        {tx.sourceCard && (
          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
            <CreditCard className="w-3 h-3" /> {tx.sourceCard}
          </span>
        )}
        {tx.isSuspect && (
          <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap">
            <Flag className="w-3 h-3" /> Suspect
          </span>
        )}
      </div>

      {/* Desktop Amount & Actions */}
      <div className="hidden lg:flex items-center justify-end gap-3 relative">
        <div className="font-mono font-black text-slate-700 whitespace-nowrap transition-transform group-hover:-translate-x-8">
          {tx.amount}{" "}
          <span className="text-xs text-slate-400">{tx.currency}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="absolute right-0 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};