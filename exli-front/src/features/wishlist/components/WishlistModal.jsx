import React, { useState, useEffect } from 'react';
import { X, Gift, Image, Flame, Zap, Droplet, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, CategoryIcon } from '../../../components/UI';
import { DEFAULT_CATEGORIES, CURRENCIES } from '../../../config/constants';

export const WishlistModal = ({ isOpen, onClose, onSave, itemToEdit, categories = DEFAULT_CATEGORIES }) => {
  const { t } = useTranslation();

  const getTodayISO = () => new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    currency: 'ILS',
    category: 'shopping',
    importance: 'medium',
    dateAdded: getTodayISO(),
    imageUrl: '',
    storeUrl: '',
    description: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (itemToEdit) {
      setFormData({
        name: itemToEdit.name || '',
        price: itemToEdit.price !== undefined ? itemToEdit.price : '',
        currency: itemToEdit.currency || 'ILS',
        category: itemToEdit.category || 'shopping',
        importance: itemToEdit.importance || 'medium',
        dateAdded: itemToEdit.dateAdded || getTodayISO(),
        imageUrl: itemToEdit.imageUrl || '',
        storeUrl: itemToEdit.storeUrl || '',
        description: itemToEdit.description || ''
      });
    } else {
      setFormData({
        name: '',
        price: '',
        currency: 'ILS',
        category: 'shopping',
        importance: 'medium',
        dateAdded: getTodayISO(),
        imageUrl: '',
        storeUrl: '',
        description: ''
      });
    }
    setErrors({});
  }, [itemToEdit, isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = t('wishlist.validation.nameRequired', 'Please enter an item name');
    if (!formData.price || isNaN(formData.price) || Number(formData.price) < 0) {
      errs.price = t('wishlist.validation.validPrice', 'Please enter a valid price amount');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        ...formData,
        price: parseFloat(formData.price)
      });
      onClose();
    } catch (err) {
      console.error('Save wishlist item error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const importanceOptions = [
    { id: 'high', label: t('wishlist.importanceLevels.high', 'High'), color: 'bg-rose-50 border-rose-300 text-rose-700 active:bg-rose-100', activeBg: 'bg-rose-600 text-white border-rose-600', icon: Flame },
    { id: 'medium', label: t('wishlist.importanceLevels.medium', 'Medium'), color: 'bg-amber-50 border-amber-300 text-amber-700 active:bg-amber-100', activeBg: 'bg-amber-500 text-white border-amber-500', icon: Zap },
    { id: 'low', label: t('wishlist.importanceLevels.low', 'Low'), color: 'bg-slate-100 border-slate-300 text-slate-700 active:bg-slate-200', activeBg: 'bg-slate-700 text-white border-slate-700', icon: Droplet },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center font-bold">
              <Gift className="w-5 h-5" />
            </div>
            <div className="text-start">
              <h2 className="font-bold text-slate-800 text-lg">
                {itemToEdit ? t('wishlist.editItem', 'Edit Item') : t('wishlist.addItem', 'Add Item')}
              </h2>
              <p className="text-xs text-slate-500">{t('dashboard.wishlist.subtitle', t('wishlist.subtitle', 'Keep track of items you love and plan your future purchases with ease.'))}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-start">
          {/* Item Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              {t('wishlist.name', 'Item Name')} *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('wishlist.namePlaceholder', 'e.g. Wireless noise-canceling headphones, sneakers, desk lamp...')}
              className={`w-full px-4 py-3 rounded-xl border bg-slate-50 text-slate-800 font-medium outline-none focus:bg-white focus:border-pink-500 transition-all ${
                errors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
              }`}
              autoFocus
            />
            {errors.name && <p className="text-xs text-rose-500 mt-1 font-medium">{errors.name}</p>}
          </div>

          {/* Price & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                {t('wishlist.price', 'Price')} *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder={t('wishlist.pricePlaceholder', 'e.g. 299')}
                className={`w-full px-4 py-3 rounded-xl border bg-slate-50 text-slate-800 font-bold outline-none focus:bg-white focus:border-pink-500 transition-all ${
                  errors.price ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                }`}
              />
              {errors.price && <p className="text-xs text-rose-500 mt-1 font-medium">{errors.price}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                {t('wishlist.currency', 'Currency')}
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-bold outline-none focus:bg-white focus:border-pink-500 transition-all"
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              {t('wishlist.category', 'Category')}
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium outline-none focus:bg-white focus:border-pink-500 transition-all"
            >
              {categories.map((cat) => {
                const translationKey = `categories.${cat.id}`;
                const translatedName = t(translationKey);
                const displayName = translatedName !== translationKey ? translatedName : cat.name;
                return (
                  <option key={cat.id} value={cat.id}>
                    {displayName}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Importance Scale */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              {t('wishlist.importance', 'Importance')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {importanceOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = formData.importance === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, importance: opt.id })}
                    className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      isSelected ? opt.activeBg + ' shadow-sm' : opt.color
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Added */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              {t('wishlist.dateAdded', 'Date Added')}
            </label>
            <input
              type="date"
              value={formData.dateAdded}
              onChange={(e) => setFormData({ ...formData, dateAdded: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium outline-none focus:bg-white focus:border-pink-500 transition-all"
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              {t('wishlist.imageUrl', 'Image URL (Optional)')}
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder={t('wishlist.imageUrlPlaceholder', 'Paste image link (e.g. https://...)')}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium outline-none focus:bg-white focus:border-pink-500 transition-all"
              />
            </div>
            {formData.imageUrl && (
              <div className="mt-2.5 p-2 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-3">
                <img
                  src={formData.imageUrl}
                  alt="Preview"
                  className="w-12 h-12 object-cover rounded-lg border border-slate-200 bg-white"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div className="text-xs text-slate-500 truncate flex-1">
                  <span className="font-semibold text-slate-700 block">{t('wishlist.previewImage', 'Image Preview')}</span>
                  <span className="truncate block text-[11px] text-slate-400">{formData.imageUrl}</span>
                </div>
              </div>
            )}
          </div>

          {/* Store URL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              {t('wishlist.storeUrl', 'Online store link')}
            </label>
            <input
              type="url"
              value={formData.storeUrl}
              onChange={(e) => setFormData({ ...formData, storeUrl: e.target.value })}
              placeholder={t('wishlist.storeUrlPlaceholder', 'Paste store or product link (e.g. Amazon, Zara, Apple...)')}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium outline-none focus:bg-white focus:border-pink-500 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              {t('wishlist.descriptionLabel', 'Description & Notes (Optional)')}
            </label>
            <textarea
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('wishlist.descriptionPlaceholder', 'Color, size, model, store notes, or personal reminders...')}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-medium outline-none focus:bg-white focus:border-pink-500 transition-all resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-pink-600 hover:bg-pink-700 text-white shadow-pink-200"
            >
              {isSubmitting
                ? (itemToEdit ? t('wishlist.updating', 'Updating...') : t('wishlist.saving', 'Saving...'))
                : (itemToEdit ? t('wishlist.updateItem', 'Update Item') : t('wishlist.saveItem', 'Save Item'))}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
