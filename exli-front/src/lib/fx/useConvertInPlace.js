/**
 * "Convert" actions for a user's saved records, used by <ForeignCurrencyAlert>'s popup
 * (docs/fx/01-fx-plan.md §11). Each function converts ONE record to the default currency at its
 * own date and writes it back in place, keeping `original` and `fx` on the record.
 */
import { useFx } from './useFx';
import { commitInChunks, buildAmountConversion } from './convertRecordsInPlace';

/** @param {string} userId */
export function useConvertInPlace(userId) {
  const { convertRecord } = useFx();

  /**
   * @param {string} collectionName  e.g. 'expenses', 'wishlist', 'recurring_expenses'
   * @param {{id:string, currency?:string, date?:string, month?:string, reportMonth?:string}} record
   * @param {number} amount
   * @param {string} [amountField]  'amount' (default) or 'price' for wishlist
   */
  const convertAmountRecord = async (collectionName, record, amount, amountField = 'amount') => {
    const fields = buildAmountConversion({
      amount: Number(amount), currency: record.currency || 'ILS', date: record.date,
      month: record.month || record.reportMonth, convertRecord, amountField,
    });
    if (!fields) throw new Error('No exchange rate available for this record.');
    await commitInChunks([{ path: ['users', userId, collectionName, record.id], fields }]);
  };

  return { convertAmountRecord };
}

export default useConvertInPlace;
