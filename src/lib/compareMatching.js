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

// Extract the topic heading after the clause ref (e.g. 'SC12, Outgoings' → 'outgoings').
const extractHeading = loc => {
  if (!loc) return ''
  const m = loc.match(/,\s*(.+)/)
  return m ? m[1].trim().toLowerCase() : ''
}

export const scorePair = (cA, cB, typeCountA, typeCountB) => {
  if (normaliseName(cA.name) === normaliseName(cB.name)) return 100

  const refA = extractClauseRef(cA.location)
  const refB = extractClauseRef(cB.location)
  const refMatch = !!(refA && refB && refA === refB)

  const overlap = keywordOverlap(cA.name, cB.name)
  const qo = quoteOverlap(cA.quote || cA.risk || '', cB.quote || cB.risk || '')

  if (cA.clause_type && cA.clause_type === cB.clause_type) {
    const ta = cA.clause_type
    const unique = (typeCountA[ta] === 1) && (typeCountB[ta] === 1)

    if (unique) {
      // Unique type: ref match alone is reliable (only one clause of this type per doc).
      if (refMatch) return 80
      return 60 + overlap * 10
    }

    // Non-unique type: ref number alone is unreliable — clause numbers shift between
    // versions when sections are added or removed. Require heading confirmation too.
    const headA = extractHeading(cA.location)
    const headB = extractHeading(cB.location)
    const headMatch = !!(headA && headB && headA === headB)

    if (refMatch && headMatch) return 80  // same number + same topic heading: strong

    // Without ref+head, score on content signals only.
    const signal = headMatch ? Math.max(overlap, qo * 0.8, 0.5) : Math.max(overlap, qo * 0.8)
    if (signal >= 0.25) return 30 + signal * 30
    if (overlap > 0) return 30 + overlap * 20
    return 0
  }

  if (overlap >= 0.5) return overlap * 20
  return 0
}
