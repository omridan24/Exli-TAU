import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WishlistHeader } from './components/WishlistHeader';
import { WishlistQuickStats } from './components/WishlistQuickStats';
import { WishlistItemCard } from './components/WishlistItemCard';
import { WishlistPlaceholderView } from './components/WishlistPlaceholderView';

export const WishlistNode = ({ userId }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');

  const mockItems = [
    {
      id: '1',
      title: t('wishlist.mockItems.laptop.title'),
      category: t('wishlist.mockItems.laptop.category'),
      estimatedPrice: 9500,
      savedAmount: 5000,
      priority: 'high',
      targetDate: '2026-12-31',
    },
    {
      id: '2',
      title: t('wishlist.mockItems.vacation.title'),
      category: t('wishlist.mockItems.vacation.category'),
      estimatedPrice: 7500,
      savedAmount: 1800,
      priority: 'medium',
      targetDate: '2027-04-15',
    },
    {
      id: '3',
      title: t('wishlist.mockItems.watch.title'),
      category: t('wishlist.mockItems.watch.category'),
      estimatedPrice: 1400,
      savedAmount: 400,
      priority: 'low',
      targetDate: '2026-10-31',
    },
  ];

  const stats = {
    totalItems: mockItems.length,
    totalValue: mockItems.reduce((acc, curr) => acc + curr.estimatedPrice, 0),
    savedAmount: mockItems.reduce((acc, curr) => acc + curr.savedAmount, 0),
    highPriority: mockItems.filter((item) => item.priority === 'high').length,
  };

  const handleAddWish = () => {
    alert(t('wishlist.placeholderNotice'));
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in relative pb-16">
      {/* 1. Header Component */}
      <WishlistHeader onAddClick={handleAddWish} />

      {/* 2. Quick Stats Grid */}
      <WishlistQuickStats stats={stats} />

      {/* 3. Tab Bar */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit mb-6">
        {['overview', 'items', 'upcoming'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(`wishlist.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* 4. Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {t('wishlist.tabs.items')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockItems.map((item) => (
                <WishlistItemCard key={item.id} item={item} />
              ))}
            </div>
          </div>

          <WishlistPlaceholderView />
        </div>
      )}

      {activeTab === 'items' && (
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">
            {t('wishlist.tabs.items')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockItems.map((item) => (
              <WishlistItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'upcoming' && <WishlistPlaceholderView />}
    </div>
  );
};

export default WishlistNode;
