import React, { useState, useEffect } from 'react';
import { LayoutGrid, Upload, PieChart as PieIcon, Settings, LogOut, Wallet, ArrowRight, TrendingUp, Users, Globe, Gift } from 'lucide-react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

import { auth, db } from './config/firebase';
import { DEFAULT_CATEGORIES } from './config/constants';
import { useLanguage } from './hooks/useLanguage';
import LoginScreen from './features/auth/LoginScreen';
import AccessDeniedScreen from './features/auth/AccessDeniedScreen';
import { ExpenseNode } from './features/expenses/ExpenseNode';
import { IncomeNode } from './features/Income/IncomeNode';
import { AnalyticsNode } from './features/analytics/AnalyticsNode';
import { SettingsNode } from './features/settings/SettingsNode';
import { WishlistNode } from './features/wishlist/WishlistNode';
import OnboardingScreen from './features/onboarding/OnboardingScreen';
import { ExliLogo } from './components/UI';

export default function App() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [activeNode, setActiveNode] = useState('dashboard');
  const [isWhitelisted, setIsWhitelisted] = useState(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(null);

  // Initialize language hook at app level for RTL/LTR switching
  const { isRTL } = useLanguage(user?.uid);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const ref = doc(db, 'whitelist', u.email);
          const snap = await getDoc(ref);
          setIsWhitelisted(snap.exists());
        } catch (e) {
          setIsWhitelisted(false);
        }
      } else {
        setIsWhitelisted(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isWhitelisted) return;
    const q = query(collection(db, 'users', user.uid, 'expenses'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user, isWhitelisted]);

  useEffect(() => {
    if (!user || !isWhitelisted) return;
    const q = query(collection(db, 'users', user.uid, 'income'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setIncome(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user, isWhitelisted]);

  useEffect(() => {
    if (!user || !isWhitelisted) return;
    const loadUserData = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.customCategories) {
          setCategories([...DEFAULT_CATEGORIES, ...data.customCategories]);
        }
        setHasCompletedOnboarding(data.hasCompletedOnboarding === true);
      } else {
        setHasCompletedOnboarding(false);
      }
    };
    loadUserData();
  }, [user, isWhitelisted]);

  if (!user) return <LoginScreen />;
  if (isWhitelisted === null) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 animate-pulse">{t('app.verifying')}</div>;
  if (isWhitelisted === false) return <AccessDeniedScreen email={user.email} onLogout={() => signOut(auth)} onRetry={() => window.location.reload()} />;
  if (hasCompletedOnboarding === null) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 animate-pulse">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 h-16 flex items-center px-6 justify-between sticky top-0 z-50">
        <div className="font-bold text-2xl text-emerald-600 flex gap-2 cursor-pointer" onClick={() => setActiveNode('dashboard')}><ExliLogo /> Exli</div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-400 font-mono">{user.email}</div>
          <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-slate-600"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>
      <main className={`mx-auto p-6 transition-all duration-300 ${activeNode === 'dashboard' ? 'max-w-6xl' : 'max-w-[1600px] w-full'}`}>
        {activeNode === 'dashboard' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Active Modules */}
            <button onClick={() => setActiveNode('import')} className="p-8 bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 text-start group transition-all relative overflow-hidden">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition-transform"><Upload /></div>
              <h3 className="font-bold text-lg text-slate-800">{t('dashboard.expenseManager.title')}</h3>
              <p className="text-slate-500 text-sm mt-1">{t('dashboard.expenseManager.description')}</p>
            </button>

            <button onClick={() => setActiveNode('income')} className="p-8 bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 text-start group transition-all relative overflow-hidden">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 mb-4 group-hover:scale-110 transition-transform"><Wallet /></div>
              <h3 className="font-bold text-lg text-slate-800">{t('dashboard.incomeManager.title')}</h3>
              <p className="text-slate-500 text-sm mt-1">{t('dashboard.incomeManager.description')}</p>
            </button>

            <button onClick={() => setActiveNode('analytics')} className="p-8 bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 text-start group transition-all relative overflow-hidden">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform"><PieIcon /></div>
              <h3 className="font-bold text-lg text-slate-800">{t('dashboard.analytics.title')}</h3>
              <p className="text-slate-500 text-sm mt-1">{t('dashboard.analytics.description')}</p>
            </button>

            <button onClick={() => setActiveNode('settings')} className="p-8 bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 text-start group transition-all relative overflow-hidden">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 mb-4 group-hover:scale-110 transition-transform"><Settings /></div>
              <h3 className="font-bold text-lg text-slate-800">{t('dashboard.settings.title')}</h3>
              <p className="text-slate-500 text-sm mt-1">{t('dashboard.settings.description')}</p>
            </button>

            <button onClick={() => setActiveNode('wishlist')} className="p-8 bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 text-start group transition-all relative overflow-hidden">
              <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center text-pink-600 mb-4 group-hover:scale-110 transition-transform"><Gift /></div>
              <h3 className="font-bold text-lg text-slate-800">{t('dashboard.wishlist.title')}</h3>
              <p className="text-slate-500 text-sm mt-1">{t('dashboard.wishlist.description')}</p>
            </button>

            {/* Coming Soon Modules */}
            <div className="p-8 bg-slate-100/60 rounded-2xl border border-slate-200 text-start relative overflow-hidden grayscale-[0.3] hover:grayscale-0 transition-all duration-300 cursor-not-allowed group">
              <div className="absolute top-3 right-3 bg-slate-200 text-slate-500 text-xs font-bold px-2 py-1 rounded-full">{t('dashboard.comingSoon')}</div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-4 group-hover:scale-105 transition-transform"><TrendingUp /></div>
              <h3 className="font-bold text-lg text-slate-700">{t('dashboard.investments.title')}</h3>
              <p className="text-slate-500 text-sm mt-1">{t('dashboard.investments.description')}</p>
            </div>

            <div className="p-8 bg-slate-100/60 rounded-2xl border border-slate-200 text-start relative overflow-hidden grayscale-[0.3] hover:grayscale-0 transition-all duration-300 cursor-not-allowed group">
              <div className="absolute top-3 right-3 bg-slate-200 text-slate-500 text-xs font-bold px-2 py-1 rounded-full">{t('dashboard.comingSoon')}</div>
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-105 transition-transform"><Users /></div>
              <h3 className="font-bold text-lg text-slate-700">{t('dashboard.partnership.title')}</h3>
              <p className="text-slate-500 text-sm mt-1">{t('dashboard.partnership.description')}</p>
            </div>

            <div className="p-8 bg-slate-100/60 rounded-2xl border border-slate-200 text-start relative overflow-hidden grayscale-[0.3] hover:grayscale-0 transition-all duration-300 cursor-not-allowed group">
              <div className="absolute top-3 right-3 bg-slate-200 text-slate-500 text-xs font-bold px-2 py-1 rounded-full">{t('dashboard.comingSoon')}</div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 mb-4 group-hover:scale-105 transition-transform"><Globe /></div>
              <h3 className="font-bold text-lg text-slate-700">{t('dashboard.community.title')}</h3>
              <p className="text-slate-500 text-sm mt-1">{t('dashboard.community.description')}</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl min-h-[600px] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <button onClick={() => setActiveNode('dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-medium">
                <ArrowRight className={`w-4 h-4 ${isRTL ? '' : 'rotate-180'}`} /> {t('app.backToDashboard')}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {activeNode === 'import' && <ExpenseNode userId={user?.uid} categories={categories} expenses={expenses} onUpdateCategories={setCategories} onComplete={() => setActiveNode('analytics')} />}
              {activeNode === 'income' && <IncomeNode userId={user?.uid} onComplete={() => setActiveNode('dashboard')} />}
              {activeNode === 'analytics' && <AnalyticsNode data={expenses} income={income} categories={categories} userId={user?.uid} />}
              {activeNode === 'settings' && <SettingsNode userId={user?.uid} categories={categories} onUpdateCategories={setCategories} />}
              {activeNode === 'wishlist' && <WishlistNode userId={user?.uid} categories={categories} />}
            </div>
          </div>
        )}
      </main>
      
      {hasCompletedOnboarding === false && (
        <OnboardingScreen 
          user={user} 
          categories={categories}
          onUpdateCategories={setCategories}
          expenses={expenses}
          onComplete={() => setHasCompletedOnboarding(true)} 
        />
      )}
    </div>
  );
}