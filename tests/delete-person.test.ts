import { describe, it, expect } from 'vitest'
import { deletePerson } from '../src/store/edit'
import type { Data, Datum } from '../src/types/data'

function createDatum(partial: Partial<Datum>): Datum {
  const { data, rels, ...rest } = partial
  return {
    id: partial.id || 'id-' + Math.random().toString(36).slice(2),
    data: { gender: 'M', ...(data || {}) },
    rels: { parents: [], spouses: [], children: [], ...(rels || {}) },
    ...rest
  }
}

describe('deletePerson', () => {
  it('removes the person and cleans references on relatives', () => {
    const data: Data = [
      createDatum({ id: 'p1', rels: { parents: [], spouses: [], children: ['p2'] } }),
      createDatum({ id: 'p2', rels: { parents: ['p1'], spouses: [], children: ['p3'] } }),
      createDatum({ id: 'p3', rels: { parents: ['p2'], spouses: [], children: [] } })
    ]

    const result = deletePerson(data[1], data)

    expect(result.success).toBe(true)
    expect(data.find(d => d.id === 'p2')).toBeUndefined()
    expect(data.find(d => d.id === 'p1')?.rels.children).not.toContain('p2')
    expect(data.find(d => d.id === 'p3')?.rels.parents).not.toContain('p2')
  })

  it('adds a placeholder person when removing the last entry', () => {
    const data: Data = [
      createDatum({ id: 'only', data: { gender: 'F' } })
    ]

    const result = deletePerson(data[0], data)

    expect(result.success).toBe(true)
    expect(data.length).toBe(1)
    expect(data[0].id).not.toBe('only')
    expect(data[0].data.gender).toBe('M')
  })
})
