import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { DEFAULT_CATEGORIES } from '../../config/constants';

import { WishlistHeader } from './components/WishlistHeader';
import { WishlistCard } from './components/WishlistCard';
import { WishlistModal } from './components/WishlistModal';
import { WishlistDeleteModal } from './components/WishlistDeleteModal';
import { WishlistShareModal } from './components/WishlistShareModal';
import { WishlistSummaryBar } from './components/WishlistSummaryBar';
import { Gift, Plus, Sparkles } from 'lucide-react';
import { Button, Card } from '../../components/UI';
import { useConvertInPlace } from '../../lib/fx/useConvertInPlace';

export const WishlistNode = ({ userId, categories = DEFAULT_CATEGORIES }) => {
  const { convertAmountRecord } = useConvertInPlace(userId);
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedImportance, setSelectedImportance] = useState('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [sharingItem, setSharingItem] = useState(null);

  // Local storage backup key
  const storageKey = `exli_wishlist_${userId || 'guest'}`;

  // 1. Subscribe to Firestore items / LocalStorage fallback
  useEffect(() => {
    // Load local storage initial state
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load wishlist from localStorage', e);
    }

    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const wishlistRef = collection(db, 'users', userId, 'wishlist');
    const q = query(wishlistRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedItems = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setItems(fetchedItems);
        setIsLoading(false);
        try {
          localStorage.setItem(storageKey, JSON.stringify(fetchedItems));
        } catch (err) {
          console.error('Failed to update localStorage', err);
        }
      },
      (error) => {
        console.error('Wishlist snapshot error:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, storageKey]);

  // Helper to persist local changes if offline or no userId
  const updateLocalAndState = (updatedList) => {
    setItems(updatedList);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
    } catch (e) {
      console.error('LocalStorage write error', e);
    }
  };

  // Add or Edit item handler
  const handleSaveItem = async (itemData) => {
    if (editingItem) {
      // Edit mode
      const updatedList = items.map((item) =>
        item.id === editingItem.id ? { ...item, ...itemData } : item
      );
      updateLocalAndState(updatedList);

      if (userId) {
        try {
          const docRef = doc(db, 'users', userId, 'wishlist', editingItem.id);
          await updateDoc(docRef, itemData);
        } catch (err) {
          console.error('Failed to update wishlist item in Firestore:', err);
        }
      }
    } else {
      // Add mode
      const tempId = `temp_${Date.now()}`;
      const newItem = {
        ...itemData,
        id: tempId,
        createdAt: new Date().toISOString()
      };

      updateLocalAndState([newItem, ...items]);

      if (userId) {
        try {
          const wishlistRef = collection(db, 'users', userId, 'wishlist');
          const docRef = await addDoc(wishlistRef, {
            ...itemData,
            createdAt: serverTimestamp()
          });
          // Update temp ID with real firestore ID
          setItems((prev) =>
            prev.map((it) => (it.id === tempId ? { ...it, id: docRef.id } : it))
          );
        } catch (err) {
          console.error('Failed to add wishlist item to Firestore:', err);
        }
      }
    }
    setEditingItem(null);
  };

  // Delete item handler
  const handleDeleteItem = async (itemId) => {
    const updatedList = items.filter((item) => item.id !== itemId);
    updateLocalAndState(updatedList);

    if (userId && !itemId.startsWith('temp_')) {
      try {
        const docRef = doc(db, 'users', userId, 'wishlist', itemId);
        await deleteDoc(docRef);
      } catch (err) {
        console.error('Failed to delete wishlist item from Firestore:', err);
      }
    }
  };

  // Filter items logic
  const filteredItems = items.filter((item) => {
    // Search query
    const queryLower = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !queryLower ||
      item.name?.toLowerCase().includes(queryLower) ||
      item.description?.toLowerCase().includes(queryLower);

    // Category filter
    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory;

    // Importance filter
    const matchesImportance =
      selectedImportance === 'all' || item.importance === selectedImportance;

    return matchesSearch && matchesCategory && matchesImportance;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50/50 min-h-[600px] animate-fade-in">
      {/* Header */}
      <WishlistHeader
        onAddItem={() => {
          setEditingItem(null);
          setIsModalOpen(true);
        }}
      />

      {/* Content Body */}
      <div className="flex-1 p-6 md:p-8 max-w-[1600px] mx-auto w-full">
        {items.length > 0 ? (
          <div>
            {/* Filter and Metrics Summary Bar */}
            <WishlistSummaryBar
              items={items}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              selectedImportance={selectedImportance}
              setSelectedImportance={setSelectedImportance}
              categories={categories}
            />

            {/* Wishlist Items Grid */}
            {filteredItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredItems.map((item) => (
                  <WishlistCard
                    key={item.id}
                    item={item}
                    categories={categories}
                    onEdit={(it) => {
                      setEditingItem(it);
                      setIsModalOpen(true);
                    }}
                    onDelete={(it) => setDeletingItem(it)}
                    onShare={(it) => setSharingItem(it)}
                    onConvert={userId && !String(item.id).startsWith('temp_')
                      ? (it) => convertAmountRecord('wishlist', it, it.price ?? it.amount, 'price')
                      : undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs">
                <p className="text-slate-500 font-medium text-base">
                  {t('common.noResults')}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedImportance('all');
                  }}
                  className="mt-3 text-xs font-bold text-pink-600 hover:text-pink-700 underline"
                >
                  {t('wishlist.clearFilters', 'Clear Filters')}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Empty State */
          <div className="max-w-2xl mx-auto py-12 px-4 text-center">
            <Card className="p-8 sm:p-12 border-dashed border-2 border-pink-200/80 bg-gradient-to-b from-white to-pink-50/30">
              <div className="w-16 h-16 bg-pink-100 text-pink-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-sm">
                <Gift className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                {t('wishlist.emptyTitle', 'Your Wishlist is Empty')}
              </h2>
              <p className="text-slate-500 text-sm max-w-md mx-auto mb-8 leading-relaxed">
                {t('wishlist.emptySubtitle', "Add products, gadgets, or gifts you're planning or dreaming to buy!")}
              </p>
              <Button
                onClick={() => {
                  setEditingItem(null);
                  setIsModalOpen(true);
                }}
                className="bg-pink-600 hover:bg-pink-700 text-white shadow-pink-200 mx-auto"
              >
                <Plus className="w-4 h-4 me-1.5" />
                <span>{t('wishlist.addItem', 'Add Item')}</span>
              </Button>
            </Card>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <WishlistModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
        itemToEdit={editingItem}
        categories={categories}
      />

      {/* Delete Confirmation Modal */}
      <WishlistDeleteModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleDeleteItem}
        item={deletingItem}
      />

      {/* Share Item Modal */}
      <WishlistShareModal
        isOpen={!!sharingItem}
        onClose={() => setSharingItem(null)}
        item={sharingItem}
        categories={categories}
      />
    </div>
  );
};
