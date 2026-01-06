/**
 * Tax Bracket Configurations by Country
 * This is the central configuration for all tax calculations
 * Add new countries here as needed
 */

export const TAX_BRACKETS = {
    Israel: {
        year: 2024,
        currency: 'ILS',
        creditValuePerPoint: 2652, // Monthly value of one tax credit point (נקודת זיכוי)
        brackets: [
            { min: 0, max: 84120, rate: 0.10 },           // 10% up to 84,120
            { min: 84120, max: 120720, rate: 0.14 },      // 14% from 84,120 to 120,720
            { min: 120720, max: 193800, rate: 0.20 },     // 20% from 120,720 to 193,800
            { min: 193800, max: 269280, rate: 0.31 },     // 31% from 193,800 to 269,280
            { min: 269280, max: 560280, rate: 0.35 },     // 35% from 269,280 to 560,280
            { min: 560280, max: 721560, rate: 0.47 },     // 47% from 560,280 to 721,560
            { min: 721560, max: null, rate: 0.50 }        // 50% above 721,560
        ],
        additionalTaxes: {
            healthTax: {
                name: 'Health Tax',
                nameHe: 'מס בריאות',
                tiers: [
                    { min: 0, max: 7522, rate: 0.0323 },      // 3.23% up to 7,522 ILS
                    { min: 7522, max: 50695, rate: 0.0517 }   // 5.17% from 7,522 to 50,695 ILS
                ],
                ceiling: 50695,
                appliesTo: 'monthly_gross'
            },
            nationalInsurance: {
                name: 'National Insurance',
                nameHe: 'ביטוח לאומי',
                tiers: [
                    { min: 0, max: 7522, rate: 0.0104 },      // 1.04% up to 7,522 ILS
                    { min: 7522, max: 50695, rate: 0.07 }     // 7.00% from 7,522 to 50,695 ILS
                ],
                ceiling: 50695,
                appliesTo: 'monthly_gross'
            }
        }
    },
    // Add more countries here...
    // UnitedStates: { ... },
    // UnitedKingdom: { ... },
};

/**
 * Get tax configuration for a specific country
 * @param {string} country - Country name
 * @returns {Object|null} Tax configuration or null if not found
 */
export const getTaxConfig = (country) => {
    return TAX_BRACKETS[country] || null;
};

/**
 * Get list of supported countries for tax calculations
 * @returns {Array<string>} List of country names
 */
export const getSupportedCountries = () => {
    return Object.keys(TAX_BRACKETS);
};

/**
 * Check if a country has tax bracket data
 * @param {string} country - Country name
 * @returns {boolean} True if country is supported
 */
export const hasTaxData = (country) => {
    return country in TAX_BRACKETS;
};

// Common tax credit point values for Israel (נקודות זיכוי)
export const ISRAEL_TAX_CREDIT_PRESETS = [
    { label: 'Single (רווק/ה)', value: 2.25 },
    { label: 'Married (נשוי/אה)', value: 2.75 },
    { label: 'Single + 1 Child', value: 3.5 },
    { label: 'Married + 1 Child', value: 4.0 },
    { label: 'Single + 2 Children', value: 4.5 },
    { label: 'Married + 2 Children', value: 5.0 },
    { label: 'Single + 3 Children', value: 5.5 },
    { label: 'Large Family (6+)', value: 6.0 },
    { label: 'Custom', value: null }
];
