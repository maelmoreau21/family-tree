import { describe, it, expect } from 'vitest'
import { stripOriginIfSame } from '../../src/utils/url'

describe('stripOriginIfSame', () => {
  it('keeps relative url unchanged', () => {
    expect(stripOriginIfSame('/uploads/photo.jpg')).toBe('/uploads/photo.jpg')
  })

  it('strips same-origin url origin', () => {
    const origin = 'http://localhost'
    const url = `${origin}/uploads/test.jpg`
    expect(stripOriginIfSame(url)).toBe('/uploads/test.jpg')
  })

  it('returns absolute url for cross-origin', () => {
    const url = 'https://example.com/uploads/test.jpg'
    expect(stripOriginIfSame(url)).toBe('https://example.com/uploads/test.jpg')
  })
})
