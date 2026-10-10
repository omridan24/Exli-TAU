import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Upload, Plus, X, RefreshCw, AlertCircle, Check, Edit2, Trash2, Rocket, Anchor, Shield, Info, GripVertical, TrendingUp, Sparkles, BadgeCheck, CloudOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CLOUD_RUN_URL } from '../../../config/firebase';

/**
 * PortfolioMapper Component
 * Reality Connector - Link actual assets to strategy buckets
 * 
 * Features:
 * - Separate search bar for adding holdings (independent from watched symbols)
 * - Unassigned inbox for new assets with drag-and-drop
 * - Bucket headers with total values and alignment messages
 * - Smart Import with progress bar and editable review modal
 * - Symbol matching/creation in database
 */
export const PortfolioMapper = ({
    userId,
    holdings = [],
    onHoldingsChange,
    targetAllocations = { long: 60, mid: 30, short: 10 },
    userCurrency = 'ILS',
    currencyRates = {} // e.g., { USD: 3.65, EUR: 4.05 }
}) => {
    const { t } = useTranslation();

    // State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [localHoldings, setLocalHoldings] = useState(holdings);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [extractedHoldings, setExtractedHoldings] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [nudgeMessage, setNudgeMessage] = useState(null);
    // State for add stock modal
    const [showAddStockModal, setShowAddStockModal] = useState(false);
    const [pendingStock, setPendingStock] = useState(null);
    const [addStockForm, setAddStockForm] = useState({
        quantity: '',
        costBasis: '',
        isFetchingPrice: false
    });

    // Background upload state - allows user to navigate away and come back
    const [uploadComplete, setUploadComplete] = useState(false);
    const [uploadCompletedData, setUploadCompletedData] = useState(null);
    const [extractedAsOfDate, setExtractedAsOfDate] = useState(null);

    // Upload interval ref
    const uploadIntervalRef = useRef(null);

    // Last-synced info per symbol, fetched lazily from the market data cache so
    // "backed by Twelve Data" cards can show when they were last refreshed.
    const [syncInfo, setSyncInfo] = useState({});
    const fetchedSymbolsRef = useRef(new Set());

    // Bucket configuration - Time-based naming
    const buckets = {
        long: {
            icon: Rocket,
            label: t('investments.buckets.long.name', 'Long Range'),
            emoji: '🚀',
            color: 'purple',
            timeRange: t('investments.buckets.long.timeRange', '10+ years')
        },
        mid: {
            icon: Anchor,
            label: t('investments.buckets.mid.name', 'Mid Range'),
            emoji: '⚓',
            color: 'blue',
            timeRange: t('investments.buckets.mid.timeRange', '3-10 years')
        },
        short: {
            icon: Shield,
            label: t('investments.buckets.short.name', 'Short Term'),
            emoji: '🛡️',
            color: 'emerald',
            timeRange: t('investments.buckets.short.timeRange', '0-3 years')
        }
    };

    // Sync with parent holdings
    useEffect(() => {
        setLocalHoldings(holdings);
    }, [holdings]);

    // Clean up upload interval on unmount
    useEffect(() => {
        return () => {
            if (uploadIntervalRef.current) {
                clearInterval(uploadIntervalRef.current);
            }
        };
    }, []);

    // Search for symbols (separate from watched symbols)
    useEffect(() => {
        if (!searchQuery || searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await fetch(`${CLOUD_RUN_URL}/market/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
                const data = await res.json();
                setSearchResults(data.filter(item => item.type !== 'forex'));
            } catch (err) {
                console.error('Search failed:', err);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // A holding is "backed" when it's linked to a real Twelve Data symbol - as
    // opposed to a synthetic LOCAL_ entry or one explicitly flagged unverified
    // (see match_or_create_symbol in the backend), which came only from manually
    // typed statement numbers with no independent price source.
    const isHoldingBacked = useCallback((holding) => (
        Boolean(holding.symbol) && !holding.unverified && !holding.symbol.startsWith('LOCAL_')
    ), []);

    // Fetch (and cache) last-synced timestamps for backed holdings so their
    // cards can show when the market data cache was last refreshed.
    const backedSymbolsKey = useMemo(() => (
        Array.from(new Set(localHoldings.filter(isHoldingBacked).map(h => h.symbol))).sort().join(',')
    ), [localHoldings, isHoldingBacked]);

    useEffect(() => {
        const symbols = backedSymbolsKey ? backedSymbolsKey.split(',') : [];
        const toFetch = symbols.filter(s => !fetchedSymbolsRef.current.has(s));
        if (toFetch.length === 0) return;
        toFetch.forEach(s => fetchedSymbolsRef.current.add(s));

        let cancelled = false;
        (async () => {
            const results = await Promise.all(toFetch.map(async (symbol) => {
                try {
                    const res = await fetch(`${CLOUD_RUN_URL}/market/symbol/${symbol}`);
                    if (!res.ok) return [symbol, null];
                    const data = await res.json();
                    return [symbol, data.lastUpdated || null];
                } catch {
                    return [symbol, null];
                }
            }));
            if (cancelled) return;
            setSyncInfo(prev => {
                const next = { ...prev };
                results.forEach(([symbol, lastUpdated]) => { next[symbol] = lastUpdated; });
                return next;
            });
        })();

        return () => { cancelled = true; };
    }, [backedSymbolsKey]);

    // Convert price to user's currency
    const convertToUserCurrency = useCallback((amount, fromCurrency) => {
        if (fromCurrency === userCurrency) return amount;
        const rate = currencyRates[fromCurrency] || 1;
        return amount * rate;
    }, [userCurrency, currencyRates]);

    // Format currency display
    const formatCurrency = useCallback((amount, currency = userCurrency) => {
        const symbol = currency === 'ILS' ? '₪' : currency === 'EUR' ? '€' : '$';
        return `${symbol}${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }, [userCurrency]);

    // Format an ISO timestamp for the "last synced" tooltip
    const formatSyncTimestamp = useCallback((isoString) => {
        if (!isoString) return null;
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return null;
        return date.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }, []);

    // Calculate bucket totals and percentages
    const bucketStats = useMemo(() => {
        const stats = {
            long: { total: 0, count: 0 },
            mid: { total: 0, count: 0 },
            short: { total: 0, count: 0 }
        };

        localHoldings.forEach(holding => {
            if (holding.bucket && stats[holding.bucket]) {
                const value = holding.currentPrice
                    ? holding.currentPrice * (holding.quantity || 0)
                    : (holding.marketValue || 0);
                const userValue = convertToUserCurrency(value, holding.currency);
                stats[holding.bucket].total += userValue;
                stats[holding.bucket].count++;
            }
        });

        const grandTotal = stats.long.total + stats.mid.total + stats.short.total;

        // Calculate percentages
        Object.keys(stats).forEach(key => {
            stats[key].percentage = grandTotal > 0
                ? Math.round((stats[key].total / grandTotal) * 100)
                : 0;
            stats[key].target = targetAllocations[key] || 0;
            stats[key].diff = stats[key].percentage - stats[key].target;
        });

        stats.grandTotal = grandTotal;
        return stats;
    }, [localHoldings, convertToUserCurrency, targetAllocations]);

    // Handle click on search result - show modal to enter quantity 
    const handleSearchResultClick = useCallback(async (item) => {
        setSearchQuery('');
        setSearchResults([]);

        // Check if already exists
        if (localHoldings.some(h => h.symbol === item.symbol)) {
            setNudgeMessage(t('investments.portfolio.alreadyExists', 'This stock is already in your portfolio'));
            setTimeout(() => setNudgeMessage(null), 3000);
            return;
        }

        // Show modal and start fetching price
        setPendingStock(item);
        setAddStockForm({ quantity: '', costBasis: '', isFetchingPrice: true });
        setShowAddStockModal(true);

        // Fetch current price in background
        let currentPrice = item.currentPrice || 0;
        try {
            const res = await fetch(`${CLOUD_RUN_URL}/market/symbol/${item.symbol}`);
            const data = await res.json();
            if (data.currentPrice) {
                currentPrice = data.currentPrice;
            }
        } catch (err) {
            console.error('Failed to fetch price:', err);
        }

        setPendingStock(prev => prev ? { ...prev, currentPrice } : null);
        setAddStockForm(prev => ({ ...prev, isFetchingPrice: false }));
    }, [localHoldings, t]);

    // Confirm adding stock from modal
    const handleConfirmAddStock = useCallback(() => {
        if (!pendingStock) return;

        const quantity = parseFloat(addStockForm.quantity) || 0;
        const costBasis = parseFloat(addStockForm.costBasis) || null;
        const marketValue = pendingStock.currentPrice && quantity ? pendingStock.currentPrice * quantity : null;

        const newHolding = {
            symbol: pendingStock.symbol,
            name: pendingStock.name,
            quantity,
            costBasis,
            marketValue,
            currentPrice: pendingStock.currentPrice || 0,
            currency: pendingStock.currency || 'USD',
            assetType: pendingStock.type || 'stock',
            bucket: null, // Unassigned
            addedAt: new Date().toISOString()
        };

        const updated = [...localHoldings, newHolding];
        setLocalHoldings(updated);
        if (onHoldingsChange) {
            onHoldingsChange(updated);
        }

        // Reset modal state
        setShowAddStockModal(false);
        setPendingStock(null);
        setAddStockForm({ quantity: '', costBasis: '', isFetchingPrice: false });
    }, [pendingStock, addStockForm, localHoldings, onHoldingsChange]);

    // Handle file upload for Smart Import with progress bar
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !userId) return;

        setIsUploading(true);
        setUploadProgress(0);

        // Simulate progress (60 seconds = 100%)
        const startTime = Date.now();
        const estimatedDuration = 60000; // 60 seconds

        uploadIntervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(95, (elapsed / estimatedDuration) * 100);
            setUploadProgress(progress);
        }, 500);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', userId);

            const res = await fetch(`${CLOUD_RUN_URL}/analyze-investment-statement`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (uploadIntervalRef.current) {
                clearInterval(uploadIntervalRef.current);
            }
            setUploadProgress(100);

            if (data.status === 'success' && data.holdings) {
                // Deduplicate by symbol and include unique identifier
                const seenSymbols = new Set();
                const uniqueHoldings = data.holdings.filter(h => {
                    const key = `${h.symbol}-${h.name}`;
                    if (seenSymbols.has(key)) {
                        return false;
                    }
                    seenSymbols.add(key);
                    return true;
                });

                const processedHoldings = uniqueHoldings.map((h, idx) => ({
                    ...h,
                    id: `extracted-${idx}-${Date.now()}`,
                    bucket: null,
                    isEditing: false,
                    include: true,
                    pricePerShare: h.pricePerUnit || (h.marketValue && h.quantity ? h.marketValue / h.quantity : null),
                    inDatabase: h.inDatabase || false,
                    newToDatabase: h.newToDatabase || false
                }));

                // Store the completed data and show notification
                // User can click to review even if they navigated away
                setExtractedHoldings(processedHoldings);
                setUploadCompletedData(processedHoldings);
                setExtractedAsOfDate(data.asOfDate || null);
                setUploadComplete(true);
                setShowReviewModal(true);
            } else {
                alert(data.error || t('investments.portfolio.extractFailed', 'Failed to extract holdings'));
            }
        } catch (err) {
            console.error('Upload failed:', err);
            alert(t('investments.portfolio.uploadFailed', 'Upload failed. Please try again.'));
            if (uploadIntervalRef.current) {
                clearInterval(uploadIntervalRef.current);
            }
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            e.target.value = ''; // Reset file input
        }
    };

    // Assign holding to bucket (click method)
    const assignToBucket = useCallback((holdingIndex, bucket) => {
        const holding = localHoldings[holdingIndex];

        // Show nudge for crypto in short bucket
        if (bucket === 'short' && holding.assetType === 'crypto') {
            setNudgeMessage(t('investments.portfolio.cryptoNudge', "Crypto is usually classified as Long Range, but you're the boss!"));
            setTimeout(() => setNudgeMessage(null), 3000);
        }

        const updated = localHoldings.map((h, i) =>
            i === holdingIndex ? { ...h, bucket } : h
        );
        setLocalHoldings(updated);
        if (onHoldingsChange) {
            onHoldingsChange(updated);
        }
    }, [localHoldings, onHoldingsChange, t]);

    // Update holding details
    const updateHolding = useCallback((index, updates) => {
        const updated = localHoldings.map((h, i) =>
            i === index ? { ...h, ...updates } : h
        );
        setLocalHoldings(updated);
        if (onHoldingsChange) {
            onHoldingsChange(updated);
        }
    }, [localHoldings, onHoldingsChange]);

    // Smart delete: if in bucket, return to unassigned; if unassigned, delete completely
    const removeHolding = useCallback((index) => {
        const holding = localHoldings[index];

        if (holding.bucket) {
            // In a bucket - return to unassigned instead of deleting
            const updated = localHoldings.map((h, i) =>
                i === index ? { ...h, bucket: null } : h
            );
            setLocalHoldings(updated);
            if (onHoldingsChange) {
                onHoldingsChange(updated);
            }
        } else {
            // Already unassigned - delete completely
            const updated = localHoldings.filter((_, i) => i !== index);
            setLocalHoldings(updated);
            if (onHoldingsChange) {
                onHoldingsChange(updated);
            }
        }
    }, [localHoldings, onHoldingsChange]);

    // Handle extracted holdings from review modal
    const confirmExtractedHoldings = useCallback(async () => {
        if (!extractedHoldings) return;

        const toAdd = extractedHoldings
            .filter(h => h.include)
            .map(({ isEditing, include, id, newToDatabase, inDatabase, needsReview, candidates, ...rest }) => ({
                ...rest,
                addedAt: new Date().toISOString()
            }));

        // Deduplicate against existing holdings
        const existingSymbols = new Set(localHoldings.map(h => h.symbol));
        const newHoldings = toAdd.filter(h => !existingSymbols.has(h.symbol));

        const updated = [...localHoldings, ...newHoldings];
        setLocalHoldings(updated);
        if (onHoldingsChange) {
            onHoldingsChange(updated);
        }

        setShowReviewModal(false);
        setExtractedHoldings(null);
        setExtractedAsOfDate(null);
    }, [extractedHoldings, localHoldings, onHoldingsChange]);

    // Update extracted holding in review modal
    const updateExtractedHolding = useCallback((idx, updates) => {
        const updated = [...extractedHoldings];
        updated[idx] = { ...updated[idx], ...updates };

        // Auto-calculate price per share if quantity and market value are set
        if (updates.quantity || updates.marketValue) {
            const h = updated[idx];
            if (h.quantity && h.marketValue && h.quantity > 0) {
                updated[idx].pricePerShare = h.marketValue / h.quantity;
            }
        }

        setExtractedHoldings(updated);
    }, [extractedHoldings]);

    // Get holdings by bucket
    const unassignedHoldings = localHoldings.filter(h => !h.bucket);
    const holdingsByBucket = {
        long: localHoldings.filter(h => h.bucket === 'long'),
        mid: localHoldings.filter(h => h.bucket === 'mid'),
        short: localHoldings.filter(h => h.bucket === 'short')
    };

    // HoldingCard component
    const HoldingCard = ({ holding, index, showBucketControls = true }) => {
        const isEditing = editingIndex === index;
        const [editValues, setEditValues] = useState({
            quantity: holding.quantity,
            costBasis: holding.costBasis,
            currentPrice: holding.currentPrice,
            name: holding.name,
            symbol: holding.symbol
        });

        const marketValue = holding.currentPrice ? holding.currentPrice * (holding.quantity || 0) : holding.marketValue;
        const userCurrencyValue = convertToUserCurrency(marketValue || 0, holding.currency);
        const isMissingPrice = !holding.currentPrice || holding.currentPrice <= 0;
        const isBacked = isHoldingBacked(holding);
        const lastSynced = formatSyncTimestamp(syncInfo[holding.symbol]);

        return (
            <div
                className={`bg-white rounded-xl p-3 border-2 shadow-sm transition-all hover:shadow-lg
                           ${!holding.bucket ? 'border-purple-100 shadow-purple-50' : 'border-slate-200'}
                           ${isMissingPrice ? 'ring-2 ring-red-200' : ''}`}
            >
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-sm
                                        ${holding.bucket === 'long' ? 'bg-purple-100 text-purple-600' :
                                holding.bucket === 'mid' ? 'bg-blue-100 text-blue-600' :
                                    holding.bucket === 'short' ? 'bg-emerald-100 text-emerald-600' :
                                        'bg-slate-100 text-slate-400'}`}>
                            {holding.bucket ? buckets[holding.bucket].emoji : '📦'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800">{holding.symbol}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${holding.assetType === 'etf' ? 'bg-blue-100 text-blue-700' :
                                    holding.assetType === 'crypto' ? 'bg-purple-100 text-purple-700' :
                                        'bg-slate-100 text-slate-600'
                                    }`}>
                                    {holding.assetType?.toUpperCase() || 'STOCK'}
                                </span>
                                {isBacked ? (
                                    <span
                                        className="inline-flex text-emerald-500"
                                        title={lastSynced
                                            ? t('investments.portfolio.backedTooltip', 'Backed by Twelve Data · Last synced {{date}}', { date: lastSynced })
                                            : t('investments.portfolio.backedTooltipPending', 'Backed by Twelve Data · Checking last sync time...')}
                                    >
                                        <BadgeCheck className="w-3.5 h-3.5" />
                                    </span>
                                ) : (
                                    <span
                                        className="inline-flex text-slate-400"
                                        title={t('investments.portfolio.notBackedTooltip', "Not linked to Twelve Data - this was entered manually, so its price and name won't auto-update.")}
                                    >
                                        <CloudOff className="w-3.5 h-3.5" />
                                    </span>
                                )}
                                {isMissingPrice && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">
                                        ⚠️ {t('investments.portfolio.needsPrice', 'Needs price')}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 truncate max-w-[150px]">{holding.name}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); setEditingIndex(isEditing ? null : index); }}
                            className="p-1 hover:bg-slate-100 rounded"
                        >
                            <Edit2 className="w-3 h-3 text-slate-400" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); removeHolding(index); }}
                            className="p-1 hover:bg-red-100 rounded"
                        >
                            <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                    </div>
                </div>

                {/* Price display */}
                <div className="mt-2 ps-[52px]">
                    <div className={`text-lg font-semibold ${isMissingPrice ? 'text-red-500' : 'text-slate-800'}`}>
                        {isMissingPrice
                            ? t('investments.portfolio.enterPrice', 'Enter price ↓')
                            : formatCurrency(marketValue || 0, holding.currency)
                        }
                    </div>
                    {holding.currency !== userCurrency && marketValue > 0 && (
                        <div className="text-xs text-slate-500">
                            ≈ {formatCurrency(userCurrencyValue, userCurrency)}
                        </div>
                    )}
                    {!isMissingPrice && (
                        <div className="text-xs text-slate-500 mt-1">
                            {holding.quantity || 0} × {formatCurrency(holding.currentPrice || 0, holding.currency)}
                        </div>
                    )}
                </div>

                {/* Edit mode */}
                {isEditing && (
                    <div className="mt-3 p-2 bg-slate-50 rounded-lg space-y-2">
                        <div>
                            <label className="text-xs text-slate-600">{t('investments.portfolio.name', 'Name')}</label>
                            <input
                                type="text"
                                value={editValues.name || ''}
                                onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                                disabled={isBacked}
                                className={`w-full px-2 py-1 border rounded text-sm ${isBacked ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'border-slate-200'}`}
                                placeholder={t('investments.portfolio.enterManually', 'Enter manually')}
                            />
                            {isBacked && (
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    {t('investments.portfolio.nameLocked', 'Locked - synced from Twelve Data')}
                                </p>
                            )}
                        </div>
                        {!isBacked && (
                            <div>
                                <label className="text-xs text-slate-600">{t('investments.portfolio.symbol', 'Symbol')}</label>
                                <input
                                    type="text"
                                    value={editValues.symbol || ''}
                                    onChange={(e) => setEditValues({ ...editValues, symbol: e.target.value.toUpperCase() })}
                                    className="w-full px-2 py-1 border rounded text-sm border-slate-200"
                                    placeholder={t('investments.portfolio.enterManually', 'Enter manually')}
                                />
                            </div>
                        )}
                        <div>
                            <label className="text-xs text-slate-600">{t('investments.portfolio.quantity', 'Quantity')}</label>
                            <input
                                type="number"
                                value={editValues.quantity}
                                onChange={(e) => setEditValues({ ...editValues, quantity: parseFloat(e.target.value) || 0 })}
                                className={`w-full px-2 py-1 border rounded text-sm ${!editValues.quantity || editValues.quantity <= 0
                                    ? 'border-red-300 bg-red-50'
                                    : 'border-slate-200'
                                    }`}
                                step="0.001"
                                placeholder={t('investments.portfolio.enterManually', 'Enter manually')}
                            />
                        </div>
                        <div>
                            <label className={`text-xs ${!editValues.currentPrice ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                                {t('investments.portfolio.currentPrice', 'Current Price per Share')}
                                {!editValues.currentPrice && <span className="ms-1">⚠️</span>}
                            </label>
                            <input
                                type="number"
                                value={editValues.currentPrice || ''}
                                onChange={(e) => setEditValues({ ...editValues, currentPrice: parseFloat(e.target.value) || null })}
                                className={`w-full px-2 py-1 border rounded text-sm ${!editValues.currentPrice || editValues.currentPrice <= 0
                                    ? 'border-red-300 bg-red-50'
                                    : 'border-slate-200'
                                    }`}
                                placeholder={t('investments.portfolio.enterManually', 'Enter manually')}
                            />
                            {!editValues.currentPrice && (
                                <p className="text-xs text-red-500 mt-1">{t('investments.portfolio.priceRequired', 'Price not found - please enter manually')}</p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs text-slate-600">{t('investments.portfolio.costBasis', 'Cost Basis')} <span className="text-slate-400">({t('common.optional', 'optional')})</span></label>
                            <input
                                type="number"
                                value={editValues.costBasis || ''}
                                onChange={(e) => setEditValues({ ...editValues, costBasis: parseFloat(e.target.value) || null })}
                                className="w-full px-2 py-1 border rounded text-sm"
                            />
                        </div>
                        <button
                            onClick={() => {
                                updateHolding(index, editValues);
                                setEditingIndex(null);
                            }}
                            className="w-full py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                        >
                            {t('common.save', 'Save')}
                        </button>
                    </div>
                )}

                {/* Bucket assignment controls - IMPROVED */}
                {showBucketControls && !holding.bucket && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 text-center mb-2 uppercase tracking-wide font-bold">
                            {t('investments.portfolio.assignToBucket', 'Assign to Bucket')}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {Object.entries(buckets).map(([key, bucket]) => (
                                <button
                                    key={key}
                                    onClick={() => assignToBucket(index, key)}
                                    className={`group flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all hover:scale-[1.02] active:scale-95
                                               ${key === 'long' ? 'border-purple-100 bg-purple-50/50 hover:border-purple-300' :
                                            key === 'mid' ? 'border-blue-100 bg-blue-50/50 hover:border-blue-300' :
                                                'border-emerald-100 bg-emerald-50/50 hover:border-emerald-300'}`}
                                >
                                    <span className="text-lg mb-1 transition-transform group-hover:scale-110">{bucket.emoji}</span>
                                    <span className={`text-[9px] font-bold uppercase tracking-wider
                                                    ${key === 'long' ? 'text-purple-700' :
                                            key === 'mid' ? 'text-blue-700' :
                                                'text-emerald-700'}`}>
                                        {t(`investments.buckets.${key}.short`, key)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Check if user has any holdings
    const hasAnyHoldings = localHoldings.length > 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-xl font-bold text-slate-800">
                    {t('investments.portfolio.title', 'My Portfolio')}
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                    {t('investments.portfolio.subtitle', 'Add what you currently have in your portfolio')}
                </p>
            </div>

            {/* Encouraging message for users with no investments */}
            {!hasAnyHoldings && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-100 text-center">
                    <Sparkles className="w-10 h-10 text-purple-500 mx-auto mb-3" />
                    <h3 className="font-semibold text-purple-800 text-lg mb-2">
                        {t('investments.portfolio.emptyTitle', 'Start Your Investment Journey!')}
                    </h3>
                    <p className="text-purple-700 text-sm">
                        {t('investments.portfolio.emptyMessage',
                            "Every great portfolio starts with a single step. Add your first investment or upload a brokerage statement to get started. We're here to help you build your future!"
                        )}
                    </p>
                </div>
            )}

            {/* Search Bar (separate from watched symbols) */}
            <div className="relative">
                <div className="relative">
                    <Search className="absolute start-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('investments.portfolio.searchPlaceholder', 'Search stocks or ETFs to add...')}
                        className="w-full ps-12 pe-4 py-3 rounded-xl border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
                    />
                </div>

                {/* Search results dropdown */}
                {(isSearching || searchResults.length > 0) && (
                    <div className="absolute top-full start-0 end-0 bg-white rounded-xl shadow-lg border border-slate-200 mt-2 max-h-60 overflow-y-auto z-50">
                        {isSearching ? (
                            <div className="flex items-center gap-2 p-4 text-slate-500">
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                {t('investments.searching', 'Searching...')}
                            </div>
                        ) : (
                            searchResults.map((item, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSearchResultClick(item)}
                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 border-b border-slate-100 last:border-0 text-start"
                                >
                                    <div>
                                        <span className="font-bold text-slate-800">{item.symbol}</span>
                                        <span className="text-slate-500 ms-2 text-sm">{item.name}</span>
                                    </div>
                                    <Plus className="w-4 h-4 text-purple-600" />
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Upload Statement Button with Progress Bar */}
            <div className="flex gap-3">
                <label className="flex-1 cursor-pointer">
                    <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={isUploading}
                    />
                    <div className={`w-full border-2 border-dashed border-purple-300 rounded-xl text-center
                                    hover:bg-purple-50 transition-all ${isUploading ? 'bg-purple-50' : ''}`}>
                        {isUploading ? (
                            <div className="p-4">
                                <div className="flex items-center justify-center gap-2 text-purple-600 mb-2">
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    {t('investments.portfolio.uploading', 'Analyzing...')}
                                </div>
                                {/* Progress bar */}
                                <div className="w-full bg-purple-100 rounded-full h-2">
                                    <div
                                        className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                                <div className="text-xs text-purple-500 mt-1">
                                    {t('investments.portfolio.estimatedTime', '~1 minute')}
                                </div>
                            </div>
                        ) : (
                            <div className="py-3 px-4">
                                <span className="flex items-center justify-center gap-2 text-purple-600">
                                    <Upload className="w-4 h-4" />
                                    {t('investments.portfolio.uploadStatement', 'Upload Statement')}
                                </span>
                            </div>
                        )}
                    </div>
                </label>
            </div>

            {/* Nudge message */}
            {nudgeMessage && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
                    <Info className="w-4 h-4" />
                    {nudgeMessage}
                </div>
            )}

            {/* Upload Complete Notification Banner */}
            {uploadComplete && uploadCompletedData && !showReviewModal && (
                <div className="fixed top-4 end-4 z-50 animate-bounce-slow">
                    <button
                        onClick={() => {
                            setExtractedHoldings(uploadCompletedData);
                            setShowReviewModal(true);
                            setUploadComplete(false);
                        }}
                        className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-6 py-3 rounded-xl shadow-lg 
                                   flex items-center gap-3 hover:from-emerald-600 hover:to-green-700 transition-all
                                   border border-emerald-300"
                    >
                        <div className="bg-white/20 rounded-full p-1">
                            <Check className="w-5 h-5" />
                        </div>
                        <div className="text-start">
                            <div className="font-semibold">{t('investments.portfolio.analysisComplete', 'Analysis Complete!')}</div>
                            <div className="text-sm text-emerald-100">{t('investments.portfolio.clickToReview', 'Click to review {{count}} holdings', { count: uploadCompletedData.length })}</div>
                        </div>
                        <X
                            className="w-4 h-4 hover:bg-white/20 rounded"
                            onClick={(e) => {
                                e.stopPropagation();
                                setUploadComplete(false);
                                setUploadCompletedData(null);
                            }}
                        />
                    </button>
                </div>
            )}

            {/* Unassigned Holdings (Inbox) */}
            <div
                className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-200 transition-all min-h-[100px]"
                onDrop={(e) => handleDrop(e, null)}
            >
                <h3 className="font-semibold text-slate-700 mb-1 flex items-center gap-2">
                    📥 {t('investments.portfolio.unassigned', 'Unassigned Assets')}
                    <span className="text-xs bg-slate-200 px-2 py-0.5 rounded-full">
                        {unassignedHoldings.length}
                    </span>
                </h3>
                <p className="text-xs text-slate-500 mb-3">
                    {t('investments.portfolio.dragHint', 'Drag and drop cards into buckets below, or use the buttons')}
                </p>
                {unassignedHoldings.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {unassignedHoldings.map((holding, idx) => {
                            const actualIndex = localHoldings.findIndex(h => h === holding);
                            return (
                                <HoldingCard
                                    key={`${holding.symbol}-${actualIndex}`}
                                    holding={holding}
                                    index={actualIndex}
                                />
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-6 border-2 border-dashed rounded-xl border-slate-200">
                        <p className="text-sm text-slate-400">
                            {t('investments.portfolio.dropToUnassign', 'Drag items here to unassign')}
                        </p>
                    </div>
                )}
            </div>

            {/* Bucket Sections with totals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(buckets).map(([key, bucket]) => {
                    const bucketHoldings = holdingsByBucket[key];
                    const stats = bucketStats[key];
                    const colorClasses = {
                        long: 'border-purple-200 bg-purple-50/50',
                        mid: 'border-blue-200 bg-blue-50/50',
                        short: 'border-emerald-200 bg-emerald-50/50'
                    };
                    return (
                        <div
                            key={key}
                            className={`rounded-2xl p-4 border-2 min-h-[200px] transition-all duration-200 ${colorClasses[key]}`}
                        >
                            {/* Bucket header with totals */}
                            <div className="mb-3">
                                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                    {bucket.emoji} {bucket.label}
                                    <span className="text-xs bg-white/60 px-2 py-0.5 rounded-full">
                                        {bucketHoldings.length}
                                    </span>
                                </h3>

                                {/* Value and percentage */}
                                {stats.total > 0 && (
                                    <div className="mt-1">
                                        <span className="text-lg font-bold text-slate-800">
                                            {formatCurrency(stats.total, userCurrency)}
                                        </span>
                                        <span className={`ms-2 text-sm font-medium ${Math.abs(stats.diff) <= 5 ? 'text-emerald-600' :
                                            stats.diff > 0 ? 'text-amber-600' : 'text-blue-600'
                                            }`}>
                                            ({stats.percentage}%)
                                        </span>
                                    </div>
                                )}

                                {/* Alignment message */}
                                {stats.total > 0 && Math.abs(stats.diff) > 5 && (
                                    <div className={`mt-1 text-xs ${stats.diff > 0 ? 'text-emerald-600' : 'text-blue-600'
                                        }`}>
                                        {stats.diff > 0
                                            ? t('investments.portfolio.overweight', '✨ {{diff}}% above target - Great job!', { diff: stats.diff })
                                            : t('investments.portfolio.underweight', '↓ {{diff}}% below target - great opportunity to grow!', { diff: Math.abs(stats.diff) })
                                        }
                                    </div>
                                )}
                            </div>

                            {bucketHoldings.length === 0 ? (
                                <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                                    <p className="text-sm text-slate-400">
                                        {t('investments.portfolio.emptyBucket', 'No assets in this bucket yet')}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {bucketHoldings.map((holding) => {
                                        const actualIndex = localHoldings.findIndex(h => h === holding);
                                        return (
                                            <HoldingCard
                                                key={`${holding.symbol}-${actualIndex}`}
                                                holding={holding}
                                                index={actualIndex}
                                                showBucketControls={false}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Grand Total */}
            {bucketStats.grandTotal > 0 && (
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-4 text-center">
                    <span className="text-slate-600">{t('investments.portfolio.totalPortfolio', 'Total Portfolio')}:</span>
                    <span className="text-2xl font-bold text-slate-800 ms-2">
                        {formatCurrency(bucketStats.grandTotal, userCurrency)}
                    </span>
                </div>
            )}

            {/* Portfolio Health Bar - Strategy vs Actual Alignment */}
            {bucketStats.grandTotal > 0 && (() => {
                // Calculate portfolio health (alignment with target)
                const currentAllocations = {
                    long: bucketStats.long.percentage,
                    mid: bucketStats.mid.percentage,
                    short: bucketStats.short.percentage
                };

                const longDiff = Math.abs(currentAllocations.long - targetAllocations.long);
                const midDiff = Math.abs(currentAllocations.mid - targetAllocations.mid);
                const shortDiff = Math.abs(currentAllocations.short - targetAllocations.short);
                const totalDeviation = longDiff + midDiff + shortDiff;
                const portfolioHealth = Math.max(0, Math.round(100 - (totalDeviation / 2)));

                const bucketEmojis = { long: '🚀', mid: '⚓', short: '🛡️' };

                return (
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                🎯 {t('investments.mission.portfolioHealth', 'Portfolio Health')}
                            </span>
                            <span className={`text-sm font-bold ${portfolioHealth >= 80 ? 'text-emerald-600' :
                                portfolioHealth >= 50 ? 'text-amber-600' : 'text-red-600'
                                }`}>
                                {portfolioHealth}% {t('investments.mission.aligned', 'Aligned')}
                            </span>
                        </div>

                        <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${portfolioHealth >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                                    portfolioHealth >= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                                        'bg-gradient-to-r from-red-400 to-red-500'
                                    }`}
                                style={{ width: `${portfolioHealth}%` }}
                            />
                        </div>

                        {/* Current vs Target breakdown */}
                        <div className="grid grid-cols-3 gap-2 mt-3 text-xs text-center">
                            {['long', 'mid', 'short'].map(bucket => (
                                <div key={bucket} className="p-2 bg-slate-50 rounded-lg">
                                    <span>{bucketEmojis[bucket]}</span>
                                    <div className="mt-1">
                                        <span className={currentAllocations[bucket] < targetAllocations[bucket] - 5 ? 'text-red-600' : 'text-slate-600'}>
                                            {Math.round(currentAllocations[bucket])}%
                                        </span>
                                        <span className="text-slate-400 mx-1">/</span>
                                        <span className="text-slate-800 font-medium">{targetAllocations[bucket]}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <p className="text-xs text-slate-400 text-center mt-2">
                            {t('investments.portfolio.healthExplanation', 'Showing how closely your portfolio matches your strategy')}
                        </p>
                    </div>
                );
            })()}

            {/* Review Modal for Extracted Holdings */}
            {showReviewModal && extractedHoldings && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="font-bold text-lg text-slate-800">
                                {t('investments.portfolio.reviewExtraction', 'Review Extracted Holdings')}
                            </h3>
                            <button
                                onClick={() => setShowReviewModal(false)}
                                className="p-2 hover:bg-slate-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto max-h-[55vh]">
                            <p className="text-sm text-slate-600 mb-2">
                                {t('investments.portfolio.reviewNote', 'Please review and edit the extracted data before adding to your portfolio.')}
                            </p>
                            {extractedAsOfDate && (
                                <p className="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
                                    <Info className="w-3.5 h-3.5 flex-shrink-0" />
                                    {t('investments.portfolio.statementAsOf', 'This statement reflects your portfolio as of {{date}} - prices and values may be out of date if that was a while ago.', { date: extractedAsOfDate })}
                                </p>
                            )}

                            {extractedHoldings.map((holding, idx) => (
                                <div
                                    key={holding.id || idx}
                                    className={`p-4 rounded-xl border mb-3 ${holding.include ? 'bg-white border-slate-200' : 'bg-slate-100 border-slate-200 opacity-60'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={holding.include}
                                                onChange={(e) => updateExtractedHolding(idx, { include: e.target.checked })}
                                                className="w-4 h-4 text-purple-600 rounded"
                                            />
                                            <div>
                                                <input
                                                    type="text"
                                                    value={holding.symbol || ''}
                                                    onChange={(e) => updateExtractedHolding(idx, { symbol: e.target.value })}
                                                    className="font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-purple-500 outline-none w-24"
                                                    placeholder={t('investments.misc.symbol', 'Symbol')}
                                                />
                                                <input
                                                    type="text"
                                                    value={holding.name || ''}
                                                    onChange={(e) => updateExtractedHolding(idx, { name: e.target.value })}
                                                    className="text-sm text-slate-500 ms-2 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-purple-500 outline-none w-48"
                                                    placeholder={t('investments.misc.name', 'Name')}
                                                />
                                                {holding.localSecurityId && (holding.unverified || !holding.symbol) && (
                                                    <div className="text-xs text-slate-400 mt-0.5">
                                                        {t('investments.portfolio.localSecurityId', 'Local security #{{id}} - no global ticker found', { id: holding.localSecurityId })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={holding.assetType || 'stock'}
                                                onChange={(e) => updateExtractedHolding(idx, { assetType: e.target.value })}
                                                className="text-xs bg-slate-100 px-2 py-1 rounded border-0"
                                            >
                                                <option value="stock">{t('investments.misc.assetType.stock', 'STOCK')}</option>
                                                <option value="etf">{t('investments.misc.assetType.etf', 'ETF')}</option>
                                                <option value="crypto">{t('investments.misc.assetType.crypto', 'CRYPTO')}</option>
                                                <option value="bond">{t('investments.misc.assetType.bond', 'BOND')}</option>
                                            </select>
                                            {holding.newToDatabase && (
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                                    {t('investments.portfolio.newAsset', 'New')}
                                                </span>
                                            )}
                                            {holding.unverified && (
                                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded" title={t('investments.portfolio.unverifiedHint')}>
                                                    ⚠️ {t('investments.portfolio.unverified')}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {holding.needsReview && holding.candidates?.length > 0 && (
                                        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                            <p className="text-xs font-medium text-amber-800 mb-2">
                                                {t('investments.portfolio.notSureWhich')}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {holding.candidates.map((c) => (
                                                    <button
                                                        key={c.symbol}
                                                        type="button"
                                                        onClick={() => updateExtractedHolding(idx, {
                                                            symbol: c.symbol,
                                                            name: c.name,
                                                            currentPrice: c.currentPrice || holding.currentPrice,
                                                            inDatabase: true,
                                                            newToDatabase: !c.inDatabase,
                                                            needsReview: false,
                                                            candidates: null
                                                        })}
                                                        className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-sm hover:bg-amber-100 hover:border-amber-400 transition-colors text-start"
                                                    >
                                                        <span className="font-bold text-slate-800">{c.symbol}</span>
                                                        <span className="text-slate-500 ms-1.5">{c.name}</span>
                                                    </button>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={() => updateExtractedHolding(idx, { needsReview: false, candidates: null })}
                                                    className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 underline"
                                                >
                                                    {t('investments.portfolio.noneOfThese')}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-4 gap-3 text-sm">
                                        <div>
                                            <label className={`text-xs ${!holding.quantity ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                                                {t('investments.portfolio.quantity', 'Quantity')}
                                                {!holding.quantity && <span className="ms-1">⚠️</span>}
                                            </label>
                                            <input
                                                type="number"
                                                value={holding.quantity || ''}
                                                onChange={(e) => updateExtractedHolding(idx, { quantity: parseFloat(e.target.value) || 0 })}
                                                className={`w-full px-2 py-1.5 border rounded focus:ring-1 ${!holding.quantity
                                                    ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-100'
                                                    : 'border-slate-200 focus:border-purple-500 focus:ring-purple-100'
                                                    }`}
                                                placeholder={t('investments.portfolio.enterManually', 'Fill manually')}
                                                step="0.001"
                                            />
                                        </div>
                                        <div>
                                            <label className={`text-xs ${!holding.pricePerShare && !holding.currentPrice ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                                                {t('investments.portfolio.pricePerShare', 'Price/Share')}
                                                {!holding.pricePerShare && !holding.currentPrice && <span className="ms-1">⚠️</span>}
                                            </label>
                                            <input
                                                type="number"
                                                value={holding.pricePerShare || holding.currentPrice || ''}
                                                onChange={(e) => updateExtractedHolding(idx, {
                                                    pricePerShare: parseFloat(e.target.value) || null,
                                                    currentPrice: parseFloat(e.target.value) || null
                                                })}
                                                className={`w-full px-2 py-1.5 border rounded focus:ring-1 ${!holding.pricePerShare && !holding.currentPrice
                                                    ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-100'
                                                    : 'border-slate-200 focus:border-purple-500 focus:ring-purple-100'
                                                    }`}
                                                placeholder={t('investments.portfolio.enterManually', 'Fill manually')}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500">{t('investments.portfolio.costBasis', 'Cost Basis')}</label>
                                            <input
                                                type="number"
                                                value={holding.costBasis || ''}
                                                onChange={(e) => updateExtractedHolding(idx, { costBasis: parseFloat(e.target.value) || null })}
                                                className="w-full px-2 py-1.5 border border-slate-200 rounded focus:border-purple-500 focus:ring-1 focus:ring-purple-100"
                                                placeholder={t('common.optionalCap', 'Optional')}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500">{t('investments.portfolio.marketValue', 'Market Value')}</label>
                                            <input
                                                type="number"
                                                value={holding.marketValue || ''}
                                                onChange={(e) => updateExtractedHolding(idx, { marketValue: parseFloat(e.target.value) || null })}
                                                className="w-full px-2 py-1.5 border rounded focus:border-purple-500 focus:ring-1 focus:ring-purple-100"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 border-t border-slate-200 flex gap-3">
                            <button
                                onClick={() => setShowReviewModal(false)}
                                className="flex-1 py-2 border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={confirmExtractedHoldings}
                                className="flex-1 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 flex items-center justify-center gap-2"
                            >
                                <Check className="w-4 h-4" />
                                {t('investments.portfolio.addSelected', 'Add Selected')} ({extractedHoldings.filter(h => h.include).length})
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Stock Modal */}
            {showAddStockModal && pendingStock && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-lg">{t('investments.portfolio.addStock', 'Add to Portfolio')}</h3>
                                    <p className="text-purple-100 text-sm">{pendingStock.name}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowAddStockModal(false);
                                        setPendingStock(null);
                                        setAddStockForm({ quantity: '', costBasis: '', isFetchingPrice: false });
                                    }}
                                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-5">
                            {/* Stock Info Card */}
                            <div className="bg-gradient-to-br from-slate-50 to-purple-50 rounded-xl p-4 border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <div className="bg-purple-600 text-white font-bold px-3 py-1.5 rounded-lg text-lg">
                                        {pendingStock.symbol}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-slate-800 font-medium truncate">{pendingStock.name}</p>
                                        <p className="text-sm text-slate-500">
                                            {addStockForm.isFetchingPrice ? (
                                                <span className="flex items-center gap-1">
                                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                                    {t('investments.portfolio.fetchingPrice', 'Getting current price...')}
                                                </span>
                                            ) : (
                                                pendingStock.currentPrice > 0
                                                    ? t('investments.portfolio.perShare', '{{price}} per share', { price: formatCurrency(pendingStock.currentPrice, pendingStock.currency || 'USD') })
                                                    : t('investments.portfolio.priceNotAvailable', 'Price not available')
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Quantity Input */}
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">
                                    {t('investments.portfolio.howManyUnits', 'How many shares/units do you hold?')}
                                </label>
                                <input
                                    type="number"
                                    value={addStockForm.quantity}
                                    onChange={(e) => setAddStockForm(prev => ({ ...prev, quantity: e.target.value }))}
                                    placeholder="e.g. 10"
                                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
                                    step="0.001"
                                    autoFocus
                                />
                            </div>

                            {/* Cost Basis Input */}
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">
                                    {t('investments.portfolio.purchasePrice', 'Average purchase price per share')}
                                    <span className="text-slate-400 font-normal"> ({t('common.optional', 'optional')})</span>
                                </label>
                                <input
                                    type="number"
                                    value={addStockForm.costBasis}
                                    onChange={(e) => setAddStockForm(prev => ({ ...prev, costBasis: e.target.value }))}
                                    placeholder="e.g. 150.00"
                                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
                                    step="0.01"
                                />
                            </div>

                            {/* Calculated Market Value */}
                            {pendingStock.currentPrice > 0 && parseFloat(addStockForm.quantity) > 0 && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-emerald-700 font-medium">
                                            {t('investments.portfolio.estimatedValue', 'Estimated current value')}
                                        </span>
                                        <span className="text-emerald-800 font-bold text-lg">
                                            {formatCurrency(pendingStock.currentPrice * parseFloat(addStockForm.quantity), pendingStock.currency || 'USD')}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowAddStockModal(false);
                                    setPendingStock(null);
                                    setAddStockForm({ quantity: '', costBasis: '', isFetchingPrice: false });
                                }}
                                className="flex-1 py-3 border border-slate-300 rounded-xl text-slate-600 hover:bg-white transition-colors font-medium"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={handleConfirmAddStock}
                                disabled={!addStockForm.quantity || parseFloat(addStockForm.quantity) <= 0}
                                className="flex-1 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4" />
                                {t('investments.portfolio.addToPortfolio', 'Add to Portfolio')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortfolioMapper;
