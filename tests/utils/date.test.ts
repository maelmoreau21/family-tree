import { describe, expect, it } from 'vitest'
import {
  normalizeDateValue,
  normalizeDatumDateFields,
  shouldNormalizeDateField
} from '../../src/utils/date'

const createDatum = () => ({
  data: {
    birthday: '5/1/1980',
    birthplace: 'Paris'
  }
})

describe('normalizeDateValue', () => {
  it('normalizes slash-separated numeric dates to dd.MM.yyyy', () => {
    expect(normalizeDateValue('30/11/2000')).toBe('30.11.2000')
  })

  it('pads single digit day and month with leading zeros', () => {
    expect(normalizeDateValue('5-1-1980')).toBe('05.01.1980')
  })

  it('preserves placeholder X tokens for unknown day or month', () => {
    expect(normalizeDateValue('X/11/2000')).toBe('X.11.2000')
    expect(normalizeDateValue('xx-3-1999')).toBe('XX.03.1999')
  })

  it('retains approximate prefix markers', () => {
    expect(normalizeDateValue('> 15/02/1985')).toBe('>15.02.1985')
    expect(normalizeDateValue('<X/XX/1990')).toBe('<X.XX.1990')
  })

  it('expands year-only inputs to placeholders for day and month', () => {
    expect(normalizeDateValue('2000')).toBe('XX.XX.2000')
  })

  it('handles textual hints by extracting numeric year', () => {
    expect(normalizeDateValue('approx 1900')).toBe('XX.XX.1900')
  })
})

describe('shouldNormalizeDateField', () => {
  it('returns true for known date identifiers', () => {
    expect(shouldNormalizeDateField('birthday')).toBe(true)
    expect(shouldNormalizeDateField('union date__ref__abc')).toBe(true)
  })

  it('skips location-like fields', () => {
    expect(shouldNormalizeDateField('birthplace')).toBe(false)
  })

  it('ignores update-related metadata', () => {
    expect(shouldNormalizeDateField('last update')).toBe(false)
  })
})

describe('normalizeDatumDateFields', () => {
  it('normalizes only date-like fields within a datum', () => {
    const datum = createDatum()
    normalizeDatumDateFields(datum as any)
    expect(datum.data.birthday).toBe('05.01.1980')
    expect(datum.data.birthplace).toBe('Paris')
  })
})
