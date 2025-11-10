import * as d3 from "../../d3"
import { TreeDatum } from "../../types/treeData"
import { toggleSvgIconOff, toggleSvgIconOn, miniTreeSvgIcon } from "../../renderers/icons"

interface DuplicateToggleDatum extends TreeDatum {
  _toggle?: unknown
  _toggle_id?: number
  _toggle_id_sp?: Record<string, number>
  data: TreeDatum["data"] & {
    main?: boolean
    _tgdp?: Record<string, number>
    _tgdp_sp?: Record<string, Record<string, number>>
  }
  spouse?: DuplicateToggleDatum & {
    _toggle_id_sp?: Record<string, number>
    data: DuplicateToggleDatum["data"]
    parent?: DuplicateToggleDatum
  }
  is_ancestry?: boolean
  sx?: number
  sy?: number
}

type ToggleUpdate = () => void

export function handleCardDuplicateToggle(
  node: HTMLElement,
  datum: DuplicateToggleDatum,
  isHorizontal: boolean,
  updateTree: ToggleUpdate
) {
  // Duplicate-branch UI removed — keep a no-op function for backward compatibility
  return
}
