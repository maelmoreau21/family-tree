import { describe, expect, it } from 'vitest'
import { formatPersonName } from '../../src/utils/person'

const baseDatum = {
  id: 'ID-42',
  data: {} as Record<string, unknown>
}

describe('formatPersonName', () => {
  it('returns "first last" when both names exist', () => {
    const result = formatPersonName({
      ...baseDatum,
      data: { 'first name': 'Ada', 'last name': 'Lovelace' }
    } as any)
    expect(result).toBe('Ada Lovelace')
  })

  it('returns only first name when last name missing', () => {
    const result = formatPersonName({
      ...baseDatum,
      data: { 'first name': 'Ada' }
    } as any)
    expect(result).toBe('Ada')
  })

  it('returns fallback "Profil <id>" when no names are available but id is provided', () => {
    const result = formatPersonName({
      ...baseDatum,
      data: {}
    } as any)
    expect(result).toBe('Profil ID-42')
  })

  it('returns "Profil sans nom" when no names or id are available', () => {
    const result = formatPersonName({
      id: '',
      data: {}
    } as any)
    expect(result).toBe('Profil sans nom')
  })

  it('returns empty string when input is null', () => {
    expect(formatPersonName(null)).toBe('')
  })
})
