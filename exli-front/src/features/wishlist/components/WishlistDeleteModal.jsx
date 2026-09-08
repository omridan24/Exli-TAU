import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/UI';

export const WishlistDeleteModal = ({ isOpen, onClose, onConfirm, item }) => {
  const { t } = useTranslation();

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200 text-start">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 className="text-xl font-bold text-slate-800 mb-2">
          {t('wishlist.confirmDeleteTitle')}
        </h3>

        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          {t('wishlist.confirmDeleteMessage', { name: item.name })}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm(item.id);
              onClose();
            }}
            className="flex-1 justify-center bg-rose-600 hover:bg-rose-700 text-white"
          >
            <Trash2 className="w-4 h-4 me-1.5" />
            {t('common.delete')}
          </Button>
        </div>
      </div>
    </div>
  );
};
