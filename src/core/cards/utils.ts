import { Datum } from "../../types/data"

export type CardDisplay = Array<string | ((d: Datum) => string) | string[]> | ((d: Datum) => string) | string

export function processCardDisplay(card_display: CardDisplay): Array<(datum: Datum) => string> {
  const card_display_arr: Array<(datum: Datum) => string> = []
  const normalizeValue = (value: unknown) => {
    if (value === null || value === undefined) return ""
    return String(value)
  }
  if (Array.isArray(card_display)) {
    card_display.forEach(d => {
      if (typeof d === 'function') {
        card_display_arr.push(d)
      } else if (typeof d === 'string') {
        card_display_arr.push((d1: Datum) => normalizeValue(d1.data[d]))
      } else if (Array.isArray(d)) {
        card_display_arr.push((d1: Datum) => d.map(key => normalizeValue(d1.data[key])).join(' ').trim())
      }
    })
  } else if (typeof card_display === 'function') {
    card_display_arr.push(card_display)
  } else if (typeof card_display === 'string') {
    card_display_arr.push((d1: Datum) => normalizeValue(d1.data[card_display]))
  }
  return card_display_arr
}

