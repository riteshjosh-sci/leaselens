/**
 * Regression tests for scorePair — run with:  node src/lib/compareMatching.test.js
 *
 * Identified 2026-07-06 via diagnose_match.py against florist_vic_hoa_v1 vs v2.
 * Python (repeatability.py) matched 16 pairs; JS matched only 15 — these cases
 * document the two genuine misses and the one correct rejection.
 */

import assert from 'assert'
import { scorePair } from './compareMatching.js'

let passed = 0, failed = 0

function test(label, fn) {
  try {
    fn()
    console.log(`  ✓  ${label}`)
    passed++
  } catch (e) {
    console.error(`  ✗  ${label}`)
    console.error(`     ${e.message}`)
    failed++
  }
}

// Both documents have 4 termination_default clauses — non-unique type.
const TC4 = { termination_default: 4 }

console.log('\nscorePair — non-unique same-type matching\n')

// ── Pair 1: Trading Hours ────────────────────────────────────────────────────
// Same clause renamed in V2 (Compliance → Default) with location shifted by 1.
// Keyword overlap 0.67 on names; near-identical opening quote.
// Old JS score: 43.3 (in candidates but lost greedy race). Target: > 50.
test('Trading Hours: renamed clause (0.67 name overlap) scores > 50', () => {
  const v1 = {
    name: 'Trading Hours Compliance',
    clause_type: 'termination_default',
    location: 'Special Condition 5, Trading',
    quote: 'The Tenant must open for trade during centre core trading hours notified by the Landlord',
  }
  const v2 = {
    name: 'Trading Hours Default',
    clause_type: 'termination_default',
    location: 'Special Condition 6, Trading',
    quote: 'The Tenant must open for trade during centre core trading hours notified by the Landlord',
  }
  const s = scorePair(v1, v2, TC4, TC4)
  assert.ok(s > 50, `expected > 50, got ${s.toFixed(1)}`)
})

// ── Pair 3: Incentive Repayment ──────────────────────────────────────────────
// Clause fully renamed in V2 and renegotiated (full → proportional repayment).
// Zero name overlap; quotes share "fitout contribution" and "rent-free period repayable".
// Old JS score: 0 (not in candidates at all). Target: > 30.
test('Incentive Repayment: fully renamed clause with shared quote content scores > 30', () => {
  const v1 = {
    name: 'Incentive Repayment on Breach',
    clause_type: 'termination_default',
    location: 'Special Condition 11, Incentive',
    quote: 'The fitout contribution and rent-free period are immediately repayable in full upon breach',
  }
  const v2 = {
    name: 'Default and Termination Rights',
    clause_type: 'termination_default',
    location: 'Special Condition 13, Incentive',
    quote: 'The fitout contribution and rent-free period are repayable only on a proportional basis',
  }
  const s = scorePair(v1, v2, TC4, TC4)
  assert.ok(s > 30, `expected > 30, got ${s.toFixed(1)}`)
})

// ── Pair 2: Repairs vs Fitout ─────────────────────────────────────────────────
// Genuinely different clauses (repairs/maintenance vs fitout completion).
// Python's same-type floor gave 60 — a false positive. JS must score 0.
test('Repairs vs Fitout: genuinely different same-type clauses score 0', () => {
  const v1 = {
    name: 'Repairs and Maintenance Breach',
    clause_type: 'termination_default',
    location: 'Special Condition 6, Repairs',
    quote: 'The Tenant must keep the Premises clean and in good repair and condition, fair wear and tear excepted',
  }
  const v2 = {
    name: 'Fitout Completion Default',
    clause_type: 'termination_default',
    location: 'Special Condition 5, Fitout',
    quote: "The Tenant must submit its fitout design and shopfront for the Landlord's approval within 30 days",
  }
  const s = scorePair(v1, v2, TC4, TC4)
  assert.strictEqual(s, 0, `expected 0, got ${s.toFixed(1)}`)
})

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
