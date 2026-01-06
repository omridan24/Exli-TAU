/**
 * Generic Tax Calculator - Country Agnostic
 * Supports marginal tax rates and tax credit systems
 */

/**
 * Calculate taxes based on marginal tax brackets
 * @param {number} annualIncome - Annual gross income
 * @param {Array} brackets - Tax brackets array from database
 * @param {number} creditPoints - Tax credit points (optional)
 * @param {number} creditValuePerPoint - Value per credit point (optional)
 * @returns {Object} { monthlyTax, annualTax, effectiveRate, bracket, breakdown }
 */
export const calculateMarginalTax = (annualIncome, brackets, creditPoints = 0, creditValuePerPoint = 0) => {
    if (!brackets || brackets.length === 0) {
        return { monthlyTax: 0, annualTax: 0, effectiveRate: 0, bracket: null, breakdown: [] };
    }

    // Sort brackets by minimum amount
    const sortedBrackets = [...brackets].sort((a, b) => a.min - b.min);

    let totalTax = 0;
    let currentBracket = sortedBrackets[0];
    const breakdown = [];

    for (const bracket of sortedBrackets) {
        if (annualIncome <= bracket.min) {
            break;
        }

        // Determine if income falls in this bracket
        const applicableMax = bracket.max || Infinity;
        if (annualIncome > bracket.min) {
            currentBracket = bracket;

            const taxableInBracket = Math.min(
                annualIncome - bracket.min,
                applicableMax - bracket.min
            );

            if (taxableInBracket > 0) {
                const taxInBracket = taxableInBracket * bracket.rate;
                totalTax += taxInBracket;

                breakdown.push({
                    min: bracket.min,
                    max: bracket.max,
                    rate: bracket.rate,
                    taxableAmount: taxableInBracket,
                    taxAmount: taxInBracket
                });
            }
        }
    }

    // Apply tax credits (creditValuePerPoint is ANNUAL, don't multiply by 12!)
    const totalCreditValue = creditPoints * creditValuePerPoint; // FIXED: Removed * 12
    const annualTaxAfterCredits = Math.max(0, totalTax - totalCreditValue);
    const monthlyTax = Math.round(annualTaxAfterCredits / 12);

    return {
        monthlyTax,
        annualTax: annualTaxAfterCredits,
        annualTaxBeforeCredits: totalTax,
        effectiveRate: annualIncome > 0 ? (annualTaxAfterCredits / annualIncome) * 100 : 0,
        bracket: currentBracket,
        breakdown,
        creditValue: totalCreditValue
    };
};

/**
 * Format tax bracket for display
 * @param {Object} bracket - Tax bracket
 * @param {string} currency - Currency code
 * @returns {string} Formatted bracket string
 */
export const formatTaxBracket = (bracket, currency = 'ILS') => {
    if (!bracket) return 'N/A';

    const minFormatted = bracket.min.toLocaleString();
    const maxFormatted = bracket.max ? bracket.max.toLocaleString() : '∞';
    const rateFormatted = (bracket.rate * 100).toFixed(0);

    return `${minFormatted} - ${maxFormatted} ${currency} (${rateFormatted}%)`;
};

/**
 * Get tax bracket description
 * @param {number} income - Annual income
 * @param {Array} brackets - Tax brackets
 * @returns {string} Description of current bracket
 */
export const getTaxBracketDescription = (income, brackets) => {
    if (!brackets || brackets.length === 0) return 'No tax data available';

    const sortedBrackets = [...brackets].sort((a, b) => a.min - b.min);

    for (const bracket of sortedBrackets) {
        const max = bracket.max || Infinity;
        if (income >= bracket.min && income < max) {
            const rate = (bracket.rate * 100).toFixed(0);
            return `Tax Bracket: ${rate}% marginal rate`;
        }
    }

    return 'Tax Bracket: Unknown';
};

/**
 * Calculate tiered tax (marginal brackets for additional taxes)
 * @param {number} amount - Amount to calculate tax on
 * @param {Array} tiers - Tax tiers array
 * @param {number} ceiling - Maximum taxable amount
 * @returns {number} Total tax amount
 */
const calculateTieredTax = (amount, tiers, ceiling) => {
    const cappedAmount = ceiling ? Math.min(amount, ceiling) : amount;
    let totalTax = 0;

    for (const tier of tiers) {
        if (cappedAmount <= tier.min) break;

        const taxableInTier = Math.min(
            cappedAmount - tier.min,
            (tier.max || Infinity) - tier.min
        );

        if (taxableInTier > 0) {
            totalTax += taxableInTier * tier.rate;
        }
    }

    return Math.round(totalTax);
};

/**
 * Calculate additional country-specific taxes (Health, National Insurance, etc.)
 * UPDATED to support TIERED rates (2025 Israeli system)
 * @param {number} monthlyGross - Monthly gross salary
 * @param {Object} additionalTaxes - Additional taxes config from country
 * @returns {Object} { total, breakdown: [{ name, rate, amount, ceiling }] }
 */
export const calculateAdditionalTaxes = (monthlyGross, additionalTaxes) => {
    if (!additionalTaxes) return { total: 0, breakdown: [] };

    const breakdown = [];
    let total = 0;

    // Health Tax (מס בריאות) - with tiered rates
    if (additionalTaxes.healthTax) {
        const ht = additionalTaxes.healthTax;
        const amount = ht.tiers
            ? calculateTieredTax(monthlyGross, ht.tiers, ht.ceiling)
            : Math.round(monthlyGross * (ht.rate || 0));

        const effectiveRate = monthlyGross > 0 ? amount / monthlyGross : 0;

        breakdown.push({
            name: ht.name,
            nameHe: ht.nameHe,
            rate: effectiveRate,
            amount: amount,
            ceiling: ht.ceiling,
            tiers: ht.tiers
        });
        total += amount;
    }

    // National Insurance (ביטוח לאומי) - with tiered rates
    if (additionalTaxes.nationalInsurance) {
        const ni = additionalTaxes.nationalInsurance;
        const amount = ni.tiers
            ? calculateTieredTax(monthlyGross, ni.tiers, ni.ceiling)
            : Math.round(Math.min(monthlyGross, ni.ceiling || Infinity) * (ni.employeeRate || 0));

        const effectiveRate = monthlyGross > 0 ? amount / monthlyGross : 0;

        breakdown.push({
            name: ni.name,
            nameHe: ni.nameHe,
            rate: effectiveRate,
            amount: amount,
            ceiling: ni.ceiling,
            tiers: ni.tiers,
            capped: monthlyGross > (ni.ceiling || Infinity)
        });
        total += amount;
    }

    return { total, breakdown };
};

