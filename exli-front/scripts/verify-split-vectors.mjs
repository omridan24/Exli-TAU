#!/usr/bin/env node
/**
 * Runs src/features/groups/utils/splitEngine.js against the shared fixtures in
 * docs/groups/split-test-vectors.json — the same file exli-backend/tests/
 * test_split_engine.py runs against the Python mirror.
 *
 * There's no JS test framework (vitest/jest) in this project yet, so this is a
 * plain Node script rather than a real test suite — deliberately, to avoid
 * adding a new dependency just for one file. Run it with:
 *   node scripts/verify-split-vectors.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { computeShares, SplitError } from '../src/features/groups/utils/splitEngine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const vectorsPath = join(__dirname, '..', '..', 'docs', 'groups', 'split-test-vectors.json');
const { vectors, errorVectors } = JSON.parse(readFileSync(vectorsPath, 'utf-8'));

let passed = 0;
let failed = 0;

for (const v of vectors) {
  try {
    const result = computeShares(v.amountMinor, v.kind, v.participants, v.payerId, v.params);
    assert.deepEqual(result, v.expectedShares, `shares mismatch for: ${v.description}`);
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    assert.equal(total, v.amountMinor, `shares must sum exactly to the amount for: ${v.description}`);
    passed++;
  } catch (err) {
    failed++;
    console.error(`FAIL [vector] ${v.description}\n  ${err.message}`);
  }
}

for (const v of errorVectors) {
  try {
    let threw = false;
    try {
      computeShares(v.amountMinor, v.kind, v.participants, v.payerId, v.params);
    } catch (err) {
      threw = err instanceof SplitError;
    }
    assert.ok(threw, `expected a SplitError for: ${v.description}`);
    passed++;
  } catch (err) {
    failed++;
    console.error(`FAIL [errorVector] ${v.description}\n  ${err.message}`);
  }
}

console.log(`${passed} passed, ${failed} failed (${vectors.length + errorVectors.length} total)`);
process.exit(failed > 0 ? 1 : 0);
