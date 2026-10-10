import React, { useState, useEffect } from 'react';
import { LayoutGrid, Upload, PieChart as PieIcon, Settings, LogOut, Wallet, ArrowRight, TrendingUp, Users, Globe, Gift } from 'lucide-react';
import { GroupsNode } from './features/groups/GroupsNode';
import { JoinGroupPage } from './features/groups/components/JoinGroupPage';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

import { auth, db } from './config/firebase';
import { DEFAULT_CATEGORIES } from './config/constants';
import { useLanguage } from './hooks/useLanguage';
import { useCurrencyPrefs } from './lib/fx/useCurrencyPrefs';
import { CurrencyProvider } from './lib/fx/CurrencyContext';
import LoginScreen from './features/auth/LoginScreen';
import AccessDeniedScreen from './features/auth/AccessDeniedScreen';
import { ExpenseNode } from './features/expenses/ExpenseNode';
import { IncomeNode } from './features/Income/IncomeNode';
import { AnalyticsNode } from './features/analytics/AnalyticsNode';
import { SettingsNode } from './features/settings/SettingsNode';
import { WishlistNode } from './features/wishlist/WishlistNode';
import OnboardingScreen from './features/onboarding/OnboardingScreen';
import { InvestmentNode } from './features/investments/InvestmentNode';
import { ExliLogo } from './components/UI';
import { MainDashboard } from './features/dashboard';

export default function App() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [activeNode, setActiveNode] = useState('dashboard');
  const [isWhitelisted, setIsWhitelisted] = useState(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  // Set when a dashboard notification opens one specific group; GroupsNode starts on that group's page
  const [groupDeepLinkId, setGroupDeepLinkId] = useState(null);
  // Set when a dashboard shortcut opens a specific analytics view (see AnalyticsNode's `target`)
  const [analyticsTarget, setAnalyticsTarget] = useState(null);
  const [pendingInviteToken, setPendingInviteToken] = useState(() => sessionStorage.getItem('exli_join_token'));

  // /join/:token deep link (no router yet — plan 02 Debate N). Stash the token in
  // sessionStorage so it survives the login redirect, then clean the URL.
  useEffect(() => {
    const match = window.location.pathname.match(/^\/join\/(.+)$/);
    if (match) {
      sessionStorage.setItem('exli_join_token', match[1]);
      setPendingInviteToken(match[1]);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Initialize language hook at app level for RTL/LTR switching
  const { isRTL } = useLanguage(user?.uid);
  // Currency preferences at app level too, so every screen's <Money>/useFx
  // calls share one CurrencyProvider (docs/fx/01-fx-plan.md §5).
  const { prefs: currencyPrefs } = useCurrencyPrefs(user?.uid);

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
    const q = query(collection(db, 'users', user.uid, 'wishlist'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      snap => setWishlist(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {
        try {
          const saved = localStorage.getItem(`exli_wishlist_${user.uid}`);
          if (saved) setWishlist(JSON.parse(saved));
        } catch (e) {}
      }
    );
  }, [user, isWhitelisted]);

  useEffect(() => {
    if (!user || !isWhitelisted) return;
    const loadUserData = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        const baseProfile = data.profile || data;
        setUserProfile({ ...baseProfile, isNewAccount: data.isNewAccount ?? baseProfile.isNewAccount });
        if (data.customCategories) {
          setCategories([...DEFAULT_CATEGORIES, ...data.customCategories]);
        }
        setHasCompletedOnboarding(data.hasCompletedOnboarding === true);
      } else {
        setUserProfile(null);
        setHasCompletedOnboarding(false);
      }
    };
    loadUserData();
  }, [user, isWhitelisted]);

  // A shortcut's analytics target only applies to the visit it was made for
  useEffect(() => {
    if (activeNode !== 'analytics') setAnalyticsTarget(null);
  }, [activeNode]);

  if (!user) return <LoginScreen />;
  if (isWhitelisted === null) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 animate-pulse">{t('app.verifying')}</div>;
  if (isWhitelisted === false) return <AccessDeniedScreen email={user.email} onLogout={() => signOut(auth)} onRetry={() => window.location.reload()} />;
  if (hasCompletedOnboarding === null) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 animate-pulse">Loading...</div>;

  if (pendingInviteToken) {
    return (
      <JoinGroupPage
        token={pendingInviteToken}
        onDone={() => {
          sessionStorage.removeItem('exli_join_token');
          setPendingInviteToken(null);
          setActiveNode('groups');
        }}
      />
    );
  }

  return (
    <CurrencyProvider defaultCurrency={currencyPrefs.defaultCurrency}>
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
          <div className="space-y-8 animate-fade-in">
            {/* Main Dashboard Hero */}
            <div className="w-full">
              <MainDashboard
                user={user}
                userProfile={userProfile}
                expenses={expenses}
                income={income}
                wishlist={wishlist}
                onNavigateAnalytics={(target) => { setAnalyticsTarget(target || null); setActiveNode('analytics'); }}
                onNavigateWishlist={() => setActiveNode('wishlist')}
                onNavigateIncome={() => setActiveNode('income')}
                onNavigateExpenses={() => setActiveNode('import')}
                onNavigateSettings={() => setActiveNode('settings')}
                onNavigateInvestments={() => setActiveNode('investments')}
                onNavigateGroup={(groupId) => { setGroupDeepLinkId(groupId); setActiveNode('groups'); }}
              />
            </div>

            {/* Homepage Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <h3 className="font-bold text-lg text-slate-800">{t('dashboard.wishlist.title', 'Wish List')}</h3>
                <p className="text-slate-500 text-sm mt-1">{t('dashboard.wishlist.description', 'Track, budget, and save for the items you want next')}</p>
              </button>

              {/* Coming Soon Modules */}
              <button onClick={() => setActiveNode('investments')} className="p-8 bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 text-start group transition-all relative overflow-hidden">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform"><TrendingUp /></div>
                <h3 className="font-bold text-lg text-slate-800">{t('dashboard.investments.title')}</h3>
                <p className="text-slate-500 text-sm mt-1">{t('dashboard.investments.description')}</p>
              </button>

              <button onClick={() => { setGroupDeepLinkId(null); setActiveNode('groups'); }} className="p-8 bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 text-start group transition-all relative overflow-hidden">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform"><Users /></div>
                <h3 className="font-bold text-lg text-slate-800">{t('groups.dashboard.title')}</h3>
                <p className="text-slate-500 text-sm mt-1">{t('groups.dashboard.description')}</p>
              </button>

              <div className="p-8 bg-slate-100/60 rounded-2xl border border-slate-200 text-start relative overflow-hidden grayscale-[0.3] hover:grayscale-0 transition-all duration-300 cursor-not-allowed group">
                <div className="absolute top-3 right-3 bg-slate-200 text-slate-500 text-xs font-bold px-2 py-1 rounded-full">{t('dashboard.comingSoon')}</div>
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 mb-4 group-hover:scale-105 transition-transform"><Globe /></div>
                <h3 className="font-bold text-lg text-slate-700">{t('dashboard.community.title')}</h3>
                <p className="text-slate-500 text-sm mt-1">{t('dashboard.community.description')}</p>
              </div>
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
              {activeNode === 'analytics' && <AnalyticsNode data={expenses} income={income} categories={categories} userId={user?.uid} target={analyticsTarget} />}
              {activeNode === 'settings' && <SettingsNode userId={user?.uid} categories={categories} onUpdateCategories={setCategories} onUpdateProfile={setUserProfile} />}
              {activeNode === 'investments' && <InvestmentNode userId={user?.uid} onComplete={() => setActiveNode('dashboard')} />}
              {activeNode === 'wishlist' && <WishlistNode userId={user?.uid} categories={categories} />}
              {activeNode === 'groups' && <GroupsNode userId={user?.uid} initialGroupId={groupDeepLinkId} />}
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
          onComplete={async () => {
            setHasCompletedOnboarding(true);
            try {
              const snap = await getDoc(doc(db, 'users', user.uid));
              if (snap.exists()) {
                const data = snap.data();
                const baseProfile = data.profile || data;
                setUserProfile({ ...baseProfile, isNewAccount: data.isNewAccount ?? baseProfile.isNewAccount });
              }
            } catch (e) {
              console.error('Error reloading user profile after onboarding:', e);
            }
          }} 
        />
      )}
    </div>
    </CurrencyProvider>
  );
}