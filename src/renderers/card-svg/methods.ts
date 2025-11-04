import { Store } from "../../types/store"
import { TreeDatum } from "../../types/treeData"

export function cardChangeMain(store: Store, {d}: {d: TreeDatum}) {
  store.updateMainId(d.data.id)
  store.updateTree({})
  return true
}