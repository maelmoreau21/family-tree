import { describe, it, expect } from 'vitest'
import { stripOriginIfSame } from '../../src/utils/url'

describe('stripOriginIfSame', () => {
  it('keeps relative url unchanged', () => {
    expect(stripOriginIfSame('/document/photo.jpg')).toBe('/document/photo.jpg')
  })

  it('strips same-origin url origin', () => {
    const origin = 'http://localhost'
    const url = `${origin}/document/test.jpg`
    expect(stripOriginIfSame(url)).toBe('/document/test.jpg')
  })

  it('returns absolute url for cross-origin', () => {
    const url = 'https://example.com/document/test.jpg'
    expect(stripOriginIfSame(url)).toBe('https://example.com/document/test.jpg')
  })
})
