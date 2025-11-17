import { Datum } from './data'

export interface TreeDatum {
  data: Datum
  x: number
  y: number
  depth: number
  parent?: TreeDatum
  tid?: string
  _x?: number
  _y?: number
  sx?: number
  sy?: number
  psx?: number
  psy?: number
  exiting?: boolean
  added?: boolean
  all_rels_displayed?: boolean
  children?: TreeDatum[]
  parents?: TreeDatum[]
  spouses?: TreeDatum[]
  spouse?: TreeDatum
  coparent?: TreeDatum
  duplicate?: number
  is_ancestry?: boolean
  sibling?: boolean
  is_private?: boolean
  _ignore_spouses?: Datum['id'][]
  __node?: HTMLElement
  __label?: string
}

export type TreeData = TreeDatum[]