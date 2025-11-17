export function escapeHtml(input?: unknown): string {
  if (input === null || input === undefined) return ''
  const s = String(input)
  return s.replace(/[&<>"'`]/g, (c) => {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#39;'
      case '`': return '&#96;'
      default: return c
    }
  })
}

export function isSafeImageSrc(url?: unknown): boolean {
  if (!url) return false
  try {
    const s = String(url).trim()
    
    if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return true
    
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return true
    return false
  } catch {
    return false
  }
}
