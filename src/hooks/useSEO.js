// src/hooks/useSEO.js
// Usage: useSEO({ title: 'Page Title', description: '...', noindex: false })

import { useEffect } from 'react'

const SITE_NAME = 'LeaseRoom'
const DEFAULT_DESCRIPTION = 'LeaseRoom analyses your retail lease or heads of agreement clause by clause — flagging risks, explaining obligations, and suggesting counter positions. Built for Australian retail tenants.'
const DEFAULT_KEYWORDS = 'retail lease Australia, lease analyser Australia, HOA review tool, heads of agreement analysis Australia, retail lease risk assessment Australia, commercial lease analysis Australia, tenant lease advice Australia, lease and HOA clause checker Australia, retail tenants Australia, business owner lease review, tenant representatives, tenant advisory'
const OG_IMAGE = 'https://leaseroom.com.au/og-image.png'
const SITE_URL = 'https://leaseroom.com.au'

export function useSEO({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  noindex = false,
  ogImage = OG_IMAGE,
  path = '',
} = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Retail Lease & HOA Analysis for Australian Tenants`

    // Title
    document.title = fullTitle

    // Helper to set/create meta tag
    const setMeta = (selector, content) => {
      let el = document.querySelector(selector)
      if (!el) {
        el = document.createElement('meta')
        const attr = selector.match(/\[([^\]]+)="/)?.[1]
        const val = selector.match(/"([^"]+)"\]/)?.[1]
        if (attr && val) { el.setAttribute(attr, val) }
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    // Standard meta
    setMeta('meta[name="description"]', description)
    setMeta('meta[name="keywords"]', keywords)
    setMeta('meta[name="robots"]', noindex ? 'noindex,nofollow' : 'index,follow')

    // Open Graph
    setMeta('meta[property="og:title"]', fullTitle)
    setMeta('meta[property="og:description"]', description)
    setMeta('meta[property="og:type"]', 'website')
    setMeta('meta[property="og:image"]', ogImage)
    setMeta('meta[property="og:url"]', `${SITE_URL}${path}`)
    setMeta('meta[property="og:site_name"]', SITE_NAME)

    // Twitter Card
    setMeta('meta[name="twitter:card"]', 'summary_large_image')
    setMeta('meta[name="twitter:title"]', fullTitle)
    setMeta('meta[name="twitter:description"]', description)
    setMeta('meta[name="twitter:image"]', ogImage)

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', `${SITE_URL}${path}`)

  }, [title, description, keywords, noindex, ogImage, path])
}
