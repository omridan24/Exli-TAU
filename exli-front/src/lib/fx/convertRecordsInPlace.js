/**
 * Writes an already-saved record's conversion back to Firestore, in place -
 * docs/fx/01-fx-plan.md §4.1/§11. One function builds the update fields for
 * an amount-bearing record (expenses, wishlist - one amount field), another
 * for an income record (bruto/taxes/neto/pension sharing one currency), and
 * a third commits any number of pre-built updates in SAFE CHUNKS, since a
 * single Firestore batch caps out at 500 writes - the "Convert all" button
 * that used to live in Settings' ReviewForeignRecords tried to do everything
 * in one batch and silently failed (no error surfaced, no chunk limit) once
 * a currency switch made hundreds of records "foreign" at once.
 */
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';

const CHUNK_SIZE = 400; // headroom under Firestore's 500-writes-per-batch limit

/**
 * jobs: Array<{ path: string[], fields: object }>. Each chunk commits
 * independently so one failing chunk doesn't lose work already written by
 * previous chunks (same "chunking trades strict atomicity for resilience"
 * reasoning as docs/fx/01-fx-plan.md §11.1).
 * @returns {Promise<number>} how many docs were actually written
 */
export async function commitInChunks(jobs) {
  let written = 0;
  for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
    const chunk = jobs.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const job of chunk) batch.update(doc(db, ...job.path), job.fields);
    await batch.commit();
    written += chunk.length;
  }
  return written;
}

/**
 * Builds the update fields for converting one single-amount record
 * (expenses, wishlist) to the default currency. Returns null when there's
 * no rate at all (reason: 'unsupported') so the caller can skip/count it
 * rather than writing garbage.
 */
export function buildAmountConversion({ amount, currency, date, month, convertRecord, amountField = 'amount' }) {
  const converted = convertRecord({ amount: Number(amount) || 0, currency, date, month });
  if (!converted) return null;
  return { [amountField]: converted.amount, currency: converted.currency, original: converted.original, fx: converted.fx };
}

/**
 * Income shares ONE currency across four fields. The rate is found once
 * (a trivial "convert 1 unit" lookup — the same pattern already used for
 * income stats in YearDashboard/AnalyticsReportsView) and applied to all
 * four, so the record stays internally consistent and only one fx/original
 * is stored for the whole thing.
 */
export function buildIncomeConversion({ bruto, taxes, neto, pension, currency, month, toDefault, defaultCurrency }) {
  const rateResult = toDefault({ amount: 1, currency, month });
  if (rateResult.value == null) return null;
  const rate = rateResult.value;
  const scale = (n) => Math.round((Number(n) || 0) * rate * 100) / 100;
  return {
    bruto: scale(bruto), taxes: scale(taxes), neto: scale(neto), pension: scale(pension),
    currency: defaultCurrency,
    original: { bruto: Number(bruto) || 0, taxes: Number(taxes) || 0, neto: Number(neto) || 0, pension: Number(pension) || 0, currency },
    fx: { rate, rateDate: rateResult.rateDate, basis: rateResult.basis, convertedAt: new Date().toISOString() },
  };
}
