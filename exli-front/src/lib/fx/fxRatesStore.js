/**
 * Loads and caches the fxRates Firestore data that fxEngine.convert() needs
 * — docs/fx/01-fx-plan.md §2.2/§5. One doc per year (fxRates/{year}) plus
 * fxRates/latest.
 *
 * Past years never change (the backend never rewrites old history), so once
 * a year is loaded it's cached forever, in memory and in localStorage, and
 * is never re-fetched. `latest` (and the current year, which is still being
 * filled in daily) are re-fetched at most once every LATEST_TTL_MS.
 *
 * This is a plain module-level cache (not a hook) so multiple components -
 * and useFx() calls in different places - share one set of loads instead of
 * each re-fetching the same year.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const LATEST_TTL_MS = 5 * 60 * 1000; // 5 minutes - latest changes at most once/day, this just avoids hammering Firestore across a session
const STORAGE_PREFIX = 'exli:fxRates:';

const yearCache = new Map(); // year (string) -> { daily, monthlyAvg }
const pendingYearLoads = new Map(); // year -> Promise, dedupes concurrent loads
let latestCache = null; // { date, rates }
let latestFetchedAt = 0;
let pendingLatestLoad = null;

function readLocalStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // private browsing, cleared storage, etc. - never fatal
  }
}

function writeLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded or unavailable - the in-memory cache still works this session
  }
}

/** A year that's clearly finished (not this year or last) is safe to trust
 * forever from localStorage without hitting Firestore at all. */
function isPastYear(year) {
  const currentYear = new Date().getUTCFullYear();
  return Number(year) < currentYear;
}

async function fetchYear(year) {
  const snap = await getDoc(doc(db, 'fxRates', String(year)));
  const data = snap.exists() ? snap.data() : { days: {}, monthlyAvg: {} };
  const entry = { daily: data.days || {}, monthlyAvg: data.monthlyAvg || {} };
  yearCache.set(String(year), entry);
  if (isPastYear(year)) {
    writeLocalStorage(STORAGE_PREFIX + year, entry);
  }
  return entry;
}

/** Loads one year's rates, deduping concurrent callers and using
 * localStorage for past years before ever touching Firestore. */
export async function loadYear(year) {
  const key = String(year);
  if (yearCache.has(key)) return yearCache.get(key);

  if (isPastYear(year)) {
    const cached = readLocalStorage(STORAGE_PREFIX + year);
    if (cached) {
      yearCache.set(key, cached);
      return cached;
    }
  }

  if (pendingYearLoads.has(key)) return pendingYearLoads.get(key);
  const promise = fetchYear(key).finally(() => pendingYearLoads.delete(key));
  pendingYearLoads.set(key, promise);
  return promise;
}

export async function loadLatest() {
  const fresh = Date.now() - latestFetchedAt < LATEST_TTL_MS;
  if (latestCache && fresh) return latestCache;
  if (pendingLatestLoad) return pendingLatestLoad;

  pendingLatestLoad = getDoc(doc(db, 'fxRates', 'latest'))
    .then((snap) => {
      latestCache = snap.exists() ? snap.data() : null;
      latestFetchedAt = Date.now();
      return latestCache;
    })
    .finally(() => {
      pendingLatestLoad = null;
    });
  return pendingLatestLoad;
}

/**
 * Builds the `table` fxEngine.convert() expects, loading only the years a
 * batch of dates/months actually touches (plus latest, always - it's the
 * fallback of last resort for any of them).
 *
 * @param {{dates?: string[], months?: string[]}} needs
 * @returns {Promise<{daily: object, monthlyAvg: object, latest: object|null}>}
 */
export async function buildTable({ dates = [], months = [] } = {}) {
  const years = yearsNeededFor(dates, months);

  const [yearEntries, latest] = await Promise.all([
    Promise.all(years.map((y) => loadYear(y))),
    loadLatest(),
  ]);

  const daily = {};
  const monthlyAvg = {};
  for (const entry of yearEntries) {
    Object.assign(daily, entry.daily);
    Object.assign(monthlyAvg, entry.monthlyAvg);
  }

  return { daily, monthlyAvg, latest };
}

/**
 * Synchronous, cache-only lookup for the years/latest already loaded - never
 * triggers a fetch. Used by useFx() to render immediately with whatever's
 * available while a background loadYearsFor() call fills in the rest.
 */
export function peekTable(years) {
  const daily = {};
  const monthlyAvg = {};
  for (const year of years) {
    const entry = yearCache.get(String(year));
    if (entry) {
      Object.assign(daily, entry.daily);
      Object.assign(monthlyAvg, entry.monthlyAvg);
    }
  }
  return { daily, monthlyAvg, latest: latestCache };
}

export function yearsNeededFor(dates = [], months = []) {
  const years = new Set();
  for (const d of dates) {
    if (d) {
      years.add(d.slice(0, 4));
      if (d.slice(5, 7) === '01') years.add(String(Number(d.slice(0, 4)) - 1));
    }
  }
  for (const m of months) {
    if (m) years.add(m.slice(0, 4));
  }
  return [...years];
}

/** Test/dev escape hatch - clears every in-memory cache (not localStorage). */
export function _resetCacheForTests() {
  yearCache.clear();
  pendingYearLoads.clear();
  latestCache = null;
  latestFetchedAt = 0;
  pendingLatestLoad = null;
}
