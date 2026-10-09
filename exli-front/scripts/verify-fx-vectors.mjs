#!/usr/bin/env node
/**
 * Runs src/lib/fx/fxEngine.js against the shared fixtures in
 * docs/fx/fx-test-vectors.json — the same file exli-backend/tests/
 * test_fx_engine.py runs against the Python mirror.
 *
 * No JS test framework (vitest/jest) in this project, so this is a plain
 * Node script rather than a real test suite, matching
 * verify-split-vectors.mjs. Run it with:
 *   node scripts/verify-fx-vectors.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { convert, FxError } from '../src/lib/fx/fxEngine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const vectorsPath = join(__dirname, '..', '..', 'docs', 'fx', 'fx-test-vectors.json');
const { table: sharedTable, vectors, errorVectors } = JSON.parse(readFileSync(vectorsPath, 'utf-8'));

const TOLERANCE = 1e-9;

function assertClose(actual, expected, message) {
  if (expected === null) {
    assert.equal(actual, null, message);
    return;
  }
  assert.ok(actual !== null && actual !== undefined, `${message} (got null/undefined)`);
  assert.ok(Math.abs(actual - expected) <= TOLERANCE, `${message}: expected ${expected}, got ${actual}`);
}

let passed = 0;
let failed = 0;

for (const v of vectors) {
  try {
    const table = v.table || sharedTable;
    const result = convert(v.input, table);

    assertClose(result.value, v.expected.value, `value mismatch for: ${v.description}`);
    assertClose(result.rate, v.expected.rate, `rate mismatch for: ${v.description}`);
    assert.equal(result.rateDate, v.expected.rateDate, `rateDate mismatch for: ${v.description}`);
    assert.equal(result.basis, v.expected.basis, `basis mismatch for: ${v.description}`);
    assert.equal(result.approximate, v.expected.approximate, `approximate mismatch for: ${v.description}`);
    assert.equal(result.reason, v.expected.reason, `reason mismatch for: ${v.description}`);
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
      convert(v.input, sharedTable);
    } catch (err) {
      threw = err instanceof FxError;
    }
    assert.ok(threw, `expected an FxError for: ${v.description}`);
    passed++;
  } catch (err) {
    failed++;
    console.error(`FAIL [errorVector] ${v.description}\n  ${err.message}`);
  }
}

console.log(`${passed} passed, ${failed} failed (${vectors.length + errorVectors.length} total)`);
process.exit(failed > 0 ? 1 : 0);
