import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// Subcomponents
import { CreateCategoryForm } from './CategorizeStepComponents/CreateCategoryForm';
import { RefundModal } from './CategorizeStepComponents/RefundModal';
import { SuspectModal } from './CategorizeStepComponents/SuspectModal';
import { EditExpenseModal } from './CategorizeStepComponents/EditExpenseModal';
import { RecurringExpenseModal } from './CategorizeStepComponents/RecurringExpenseModal';
import { TransactionCard } from './CategorizeStepComponents/TransactionCard';
import { RecurringHintBox } from './CategorizeStepComponents/RecurringHintBox';
import { CategoriesGrid } from './CategorizeStepComponents/CategoriesGrid';
import { ActionSidebar } from './CategorizeStepComponents/ActionSidebar';

// Category translation mapping
const categoryKeyMap = {
    'food': 'food', 'groceries': 'groceries', 'transport': 'transport', 'shopping': 'shopping',
    'housing': 'housing', 'bills': 'bills', 'travel': 'travel', 'health': 'health',
    'education': 'education', 'pets': 'pets', 'gifts': 'gifts', 'entertainment': 'entertainment', 'other': 'other'
};

export const ExpenseStepCategorize = ({
    isCreatingCat,
    setIsCreatingCat,
    newCatName,
    setNewCatName,
    onQuickAddCategory,
    currentTx,
    currentIndex,
    handleUndo,
    lastUndoChoice,
    onShiftAmount,
    categories,
    suggestedCategoryId,
    onCategorize,
    onSkip,
    cleanDateDisplay,
    onUpdateTransaction, // Added prop for editing transaction
    recurringExpenses // NEW: for recurring detection
}) => {
    const { t } = useTranslation();

    // Internal state
    const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
    const [isSuspectModalOpen, setIsSuspectModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isRecurringListOpen, setIsRecurringListOpen] = useState(false);

    // Edit Modal State
    const [editForm, setEditForm] = useState({ description: '', amount: '', date: '' });
    
    // Percentage Split State
    const baseAmountRef = useRef(null);
    const [selectedSplit, setSelectedSplit] = useState(null);

    // Reset base amount and selection when moving to a new transaction
    useEffect(() => {
        if (currentTx) {
            baseAmountRef.current = currentTx.amount;
            setSelectedSplit(null);
        }
    }, [currentIndex, currentTx]);

    const getCategoryName = (cat) => {
        const key = categoryKeyMap[cat.id];
        return key ? t(`categories.${key}`) : cat.name;
    };

    const openEditModal = () => {
        setEditForm({
            description: currentTx.description,
            amount: currentTx.amount,
            date: currentTx.date
        });
        setIsEditModalOpen(true);
    };

    const saveEdit = () => {
        const newAmount = parseFloat(editForm.amount);
        baseAmountRef.current = newAmount;
        setSelectedSplit(null);
        onUpdateTransaction({
            description: editForm.description,
            amount: newAmount,
            date: editForm.date
        });
        setIsEditModalOpen(false);
    };

    const applyPercentage = (percentage) => {
        const base = baseAmountRef.current !== null ? baseAmountRef.current : currentTx.amount;
        const newAmount = parseFloat((base * (percentage / 100)).toFixed(2));
        setSelectedSplit(percentage);
        onUpdateTransaction({
            description: currentTx.description,
            amount: newAmount,
            date: currentTx.date
        });
    };

    // Check if current transaction matches a recurring expense
    // IMPROVED: Uses confidence scoring and priority matching
    const matchingRecurring = useMemo(() => {
        if (!recurringExpenses || !currentTx) return null;

        // Normalize function for comparison - preserves Hebrew characters
        const normalize = (str) => str
            .toLowerCase()
            .replace(/[^a-z0-9א-ת\s]/gi, '')  // Keep letters, numbers, Hebrew, spaces
            .replace(/\s+/g, ' ')
            .trim();

        const normalizedDesc = normalize(currentTx.description);

        // Score each recurring expense
        const matches = recurringExpenses
            .map(rec => {
                const pattern = normalize(rec.matchPattern || rec.name || '');

                // Skip if pattern is empty or too short
                if (!pattern || pattern.length < 2) return null;

                // Check different match types
                const isExactMatch = normalizedDesc === pattern;
                const startsWithPattern = normalizedDesc.startsWith(pattern);
                const containsPattern = normalizedDesc.includes(pattern);

                // Require pattern to be at least 3 characters for contains match
                // to avoid false positives from short patterns
                const validContains = containsPattern && pattern.length >= 3;

                if (!isExactMatch && !startsWithPattern && !validContains) {
                    return null;
                }

                // Amount matching with variable tolerance
                const amountDiff = Math.abs(currentTx.amount - rec.amount);
                const amountRatio = rec.amount > 0 ? amountDiff / rec.amount : 1;

                // Stricter for exact matches, looser for utility-type expenses (bills, rent)
                const isUtilityCategory = ['bills', 'utilities', 'housing']
                    .includes(rec.category?.toLowerCase());
                const amountTolerance = isUtilityCategory ? 0.15 : 0.05;

                if (amountRatio > amountTolerance) {
                    return null;
                }

                // Calculate confidence score (0-100)
                let confidence = 0;
                if (isExactMatch) confidence = 100;
                else if (startsWithPattern) confidence = 80;
                else if (validContains) confidence = 60;

                // Bonus for closer amount match
                confidence += Math.round((1 - amountRatio) * 20);

                return { recurring: rec, confidence };
            })
            .filter(Boolean)
            .sort((a, b) => b.confidence - a.confidence);

        // Return highest confidence match (if above threshold of 70)
        return matches.length > 0 && matches[0].confidence >= 70
            ? matches[0].recurring
            : null;
    }, [currentTx, recurringExpenses]);

    if (isCreatingCat) {
        return (
            <CreateCategoryForm 
                newCatName={newCatName}
                setNewCatName={setNewCatName}
                onQuickAddCategory={onQuickAddCategory}
                setIsCreatingCat={setIsCreatingCat}
            />
        );
    }

    if (isRefundModalOpen) {
        return (
            <RefundModal 
                categories={categories}
                onCategorize={onCategorize}
                setIsRefundModalOpen={setIsRefundModalOpen}
                getCategoryName={getCategoryName}
            />
        );
    }

    if (isSuspectModalOpen) {
        return (
            <SuspectModal 
                onCategorize={onCategorize}
                setIsSuspectModalOpen={setIsSuspectModalOpen}
            />
        );
    }

    // Full Edit Modal
    if (isEditModalOpen) {
        return (
            <EditExpenseModal 
                editForm={editForm}
                setEditForm={setEditForm}
                saveEdit={saveEdit}
                setIsEditModalOpen={setIsEditModalOpen}
            />
        );
    }

    // Recurring Expense List Modal
    if (isRecurringListOpen) {
        return (
            <RecurringExpenseModal 
                recurringExpenses={recurringExpenses}
                onCategorize={onCategorize}
                setIsRecurringListOpen={setIsRecurringListOpen}
            />
        );
    }

    if (!currentTx) return null;

    return (
        <div className="flex flex-col md:flex-row gap-6 mb-8">
            {/* Main Content Area */}
            <div className="flex-1 space-y-4">
                <TransactionCard 
                    currentTx={currentTx}
                    cleanDateDisplay={cleanDateDisplay}
                    currentIndex={currentIndex}
                    handleUndo={handleUndo}
                />

                <RecurringHintBox 
                    matchingRecurring={matchingRecurring}
                    onCategorize={onCategorize}
                />

                <CategoriesGrid 
                    categories={categories}
                    suggestedCategoryId={suggestedCategoryId}
                    lastUndoChoice={lastUndoChoice}
                    onCategorize={onCategorize}
                    getCategoryName={getCategoryName}
                />
            </div>

            {/* Right Sidebar */}
            <ActionSidebar 
                openEditModal={openEditModal}
                applyPercentage={applyPercentage}
                selectedSplit={selectedSplit}
                setIsCreatingCat={setIsCreatingCat}
                setIsRefundModalOpen={setIsRefundModalOpen}
                onSkip={onSkip}
                recurringExpenses={recurringExpenses}
                setIsRecurringListOpen={setIsRecurringListOpen}
                setIsSuspectModalOpen={setIsSuspectModalOpen}
            />
        </div>
    );
};
