export function getBaseOrigin() {
  if (typeof window !== 'undefined' && window.location && window.location.origin) return window.location.origin
  return 'http://localhost'
}

export function stripOriginIfSame(rawUrl?: unknown): string {
  if (rawUrl === null || rawUrl === undefined) return ''
  const s = String(rawUrl).trim()
  if (!s) return ''
  try {
    const base = getBaseOrigin()
    const parsed = new URL(s, base)
    if (parsed.origin === base) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }
    return parsed.toString()
  } catch (_err) {
    return s
  }
}

export function looksLikeHttpUrl(rawUrl?: unknown) {
  if (!rawUrl) return false
  const s = String(rawUrl).trim()
  return s.startsWith('http://') || s.startsWith('https://')
}
