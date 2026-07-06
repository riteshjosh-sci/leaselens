// Pure clause-matching functions extracted from CompareTab.jsx.
// Standalone and importable so regression tests can run without a browser.

export const normaliseName = n =>
  (n || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()

export const keyWords = n =>
  normaliseName(n).split(' ').filter(w => w.length > 3).sort()

export const keywordOverlap = (a, b) => {
  const wa = keyWords(a), wb = keyWords(b)
  if (!wa.length || !wb.length) return 0
  return wa.filter(w => wb.includes(w)).length / Math.max(wa.length, wb.length)
}

// Quote overlap uses a higher word-length threshold (> 5) to avoid boilerplate
// words like "tenant" / "must" inflating similarity between different clauses.
const quoteWords = n =>
  normaliseName(n).split(' ').filter(w => w.length > 5).sort()

const quoteOverlap = (a, b) => {
  const wa = quoteWords(a), wb = quoteWords(b)
  if (!wa.length || !wb.length) return 0
  return wa.filter(w => wb.includes(w)).length / Math.max(wa.length, wb.length)
}

export const extractClauseRef = loc => {
  if (!loc) return ''
  const sc = loc.match(/^(SC\d+[a-zA-Z]?)\b/)
  if (sc) return sc[1].toUpperCase()
  const n = loc.match(/\b(\d+(?:\.\d+)*)\b/)
  return n ? n[1] : ''
}

export const scorePair = (cA, cB, typeCountA, typeCountB) => {
  if (normaliseName(cA.name) === normaliseName(cB.name)) return 100

  const refA = extractClauseRef(cA.location)
  const refB = extractClauseRef(cB.location)
  if (refA && refB && refA === refB) {
    if (!cA.clause_type || !cB.clause_type || cA.clause_type === cB.clause_type) return 80
  }

  const overlap = keywordOverlap(cA.name, cB.name)

  if (cA.clause_type && cA.clause_type === cB.clause_type) {
    const unique = (typeCountA[cA.clause_type] === 1) && (typeCountB[cA.clause_type] === 1)
    if (unique) return 60 + overlap * 10

    // Non-unique same type: name overlap alone is unreliable when clause is renamed in V2.
    // Also compute quote keyword overlap (words > 5 chars) as secondary signal.
    // Combined signal must reach 0.25 to score — prevents boilerplate words (e.g. "tenant")
    // from creating false matches between genuinely different same-type clauses.
    const qo = quoteOverlap(cA.quote || cA.risk || '', cB.quote || cB.risk || '')
    const signal = Math.max(overlap, qo * 0.8)
    if (signal >= 0.25) return 30 + signal * 30
    if (overlap > 0) return 30 + overlap * 20
  }

  if (overlap >= 0.5) return overlap * 20
  return 0
}
