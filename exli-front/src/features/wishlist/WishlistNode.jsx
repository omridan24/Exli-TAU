import React from 'react';
import { WishlistHeader } from './components/WishlistHeader';
import { WishlistPlaceholder } from './components/WishlistPlaceholder';

export const WishlistNode = () => {
  return (
    <div className="flex flex-col h-full bg-slate-50/50 min-h-[500px]">
      <WishlistHeader />
      <div className="flex-1 overflow-y-auto">
        <WishlistPlaceholder />
      </div>
    </div>
  );
};
