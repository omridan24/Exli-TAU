import React from 'react';

/**
 * Visual tax bracket graph showing marginal tax rates
 * Displays all brackets as steps with user's current position highlighted
 */
export const TaxBracketGraph = ({ annualIncome, brackets, currency = 'ILS', effectiveRate = 0, taxBreakdown = [] }) => {
    if (!brackets || brackets.length === 0) return null;

    const sortedBrackets = [...brackets].sort((a, b) => a.min - b.min);

    // Find which bracket the user is in
    const currentBracket = sortedBrackets.find(b =>
        annualIncome >= b.min && (b.max === null || annualIncome < b.max)
    );

    return (
        <div className="space-y-3">
            {/* Step visualization */}
            <div className="flex items-end gap-1 h-28 mb-2">
                {sortedBrackets.map((bracket, idx) => {
                    const isActive = bracket === currentBracket;
                    const height = 30 + (idx * 10); // Increasing height for each bracket

                    // Color gradient from green (low tax) to red (high tax)
                    const hue = 120 - (idx * 17); // 120=green, 0=red
                    const saturation = 70;
                    const lightness = isActive ? 55 : 70;

                    return (
                        <div
                            key={idx}
                            className={`flex-1 transition-all rounded-t-lg relative group ${isActive
                                ? 'ring-4 ring-orange-400 shadow-xl scale-105 z-10'
                                : 'opacity-70 hover:opacity-90'
                                }`}
                            style={{
                                height: `${height}%`,
                                backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`
                            }}
                        >
                            {/* Rate label */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className={`text-xs font-black ${isActive ? 'text-white drop-shadow-md' : 'text-slate-700'
                                    }`}>
                                    {(bracket.rate * 100).toFixed(0)}%
                                </span>
                            </div>

                            {/* Active indicator arrow */}
                            {isActive && (
                                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 animate-bounce">
                                    <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-black px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                                        You're here!
                                    </div>
                                    <div className="w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-orange-500 mx-auto mt-0"></div>
                                </div>
                            )}

                            {/* Hover tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-32 text-center">
                                <div className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg">
                                    {bracket.min.toLocaleString()} - {bracket.max ? bracket.max.toLocaleString() : '∞'}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Current bracket detailed info */}
            {currentBracket && (
                <>
                    <div className="bg-gradient-to-r from-orange-100 to-amber-100 border-2 border-orange-300 p-3 rounded-lg text-sm">
                        <div className="font-bold text-orange-900 flex items-center gap-2">
                            <span className="text-2xl">{(currentBracket.rate * 100).toFixed(0)}%</span>
                            <span>Marginal Tax Rate</span>
                        </div>
                        <div className="text-xs text-orange-700 mt-1">
                            Income Range: {currentBracket.min.toLocaleString()} - {
                                currentBracket.max ? currentBracket.max.toLocaleString() : '∞'
                            } {currency}/year
                        </div>
                        <div className="text-xs text-orange-600 mt-1">
                            Your annual income: {annualIncome.toLocaleString()} {currency}
                        </div>
                    </div>

                    {/* NEW: Tax Breakdown with Step-by-Step Calculation */}
                    <div className="bg-emerald-50 border-2 border-emerald-300 p-3 rounded-lg">
                        <div className="text-sm text-emerald-700 font-bold mb-2">
                            ✅ Total Tax Paid: {effectiveRate.toFixed(1)}%
                        </div>

                        {/* Step-by-step breakdown - MONTHLY AMOUNTS */}
                        {taxBreakdown && taxBreakdown.length > 0 && (
                            <div className="text-xs text-emerald-600 space-y-0.5">
                                {taxBreakdown.map((step, idx) => {
                                    if (step.taxableAmount <= 0) return null;

                                    const isFirst = idx === 0;

                                    // Convert to monthly amounts (annual / 12)
                                    const monthlyTaxable = Math.round(step.taxableAmount / 12);
                                    const monthlyTax = Math.round(step.taxAmount / 12);

                                    const label = isFirst
                                        ? `First ${monthlyTaxable.toLocaleString()}/mo`
                                        : `Next ${monthlyTaxable.toLocaleString()}/mo`;

                                    return (
                                        <div key={idx}>
                                            • {label} @ {(step.rate * 100).toFixed(0)}% = {monthlyTax.toLocaleString()}/mo
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
