import * as d3 from "d3"
import type { Selection } from "d3-selection"
import { onZoomSetup } from "../../renderers/html"
import createSvg from "../../renderers/svg"
import { TreeDatum } from "../../types/treeData"

interface TreeDatumComponent extends TreeDatum {
  unique_id?: string
}

export default function cardComponentSetup(cont: HTMLElement) {
  const getSvgView = () => cont.querySelector('svg .view') as HTMLElement
  const getHtmlSvg = () => cont.querySelector('#htmlSvg') as HTMLElement
  const getHtmlView = () => cont.querySelector('#htmlSvg .cards_view') as HTMLElement

  createSvg(cont, {onZoom: onZoomSetup(getSvgView, getHtmlView)})
  d3.select<HTMLElement, undefined>(getHtmlSvg()).append("div").attr("class", "cards_view_fake").style('display', 'none')  // important for handling data

  return setupReactiveTreeData(getHtmlSvg)
}

function setupReactiveTreeData(getHtmlSvg: () => HTMLElement) {
  let tree_data: TreeDatumComponent[] = []

  return function getReactiveTreeData(new_tree_data: TreeDatum[]) {
    const tree_data_exit = getTreeDataExit(new_tree_data, tree_data)
    tree_data = [...new_tree_data as TreeDatumComponent[], ...tree_data_exit]
  assignUniqueIdToTreeData(getCardsViewFake(getHtmlSvg), tree_data)
    return tree_data
  }

  function assignUniqueIdToTreeData(div: HTMLElement, tree_data: TreeDatumComponent[]) {
    const container = d3.select<HTMLElement, undefined>(div)
    const card = container.selectAll<HTMLDivElement, TreeDatumComponent>("div.card_cont_2fake").data(tree_data, d => d.data.id)
  const card_exit = card.exit() as Selection<HTMLDivElement, TreeDatumComponent, HTMLElement, undefined>
    const card_enter = card
      .enter()
      .append("div")
      .attr("class", "card_cont_2fake")
      .style('display', 'none')
      .attr("data-id", () => Math.random().toString(36).slice(2)) as Selection<HTMLDivElement, TreeDatumComponent, HTMLElement, undefined>
    const card_update = card_enter.merge(card) as Selection<HTMLDivElement, TreeDatumComponent, HTMLElement, undefined>
  
    card_exit.each(cardExit)
    card_enter.each(cardEnter)
    card_update.each(cardUpdate)
  
    function cardEnter(this: HTMLDivElement, d: TreeDatumComponent) {
      d.unique_id = d3.select(this).attr("data-id")
    }
  
    function cardUpdate(this: HTMLDivElement, d: TreeDatumComponent) {
      d.unique_id = d3.select(this).attr("data-id")
    }
  
    function cardExit(this: HTMLDivElement, d: TreeDatumComponent) {
      if (!d) return
      d.unique_id = d3.select(this).attr("data-id")
      d3.select(this).remove()
    }
  }

  function getTreeDataExit(new_tree_data: TreeDatum[], old_tree_data: TreeDatumComponent[]) {
    if (old_tree_data.length > 0) {
      return old_tree_data.filter(d => !new_tree_data.find(t => t.data.id === d.data.id))
    } else {
      return []
    }
  }
}

export function getCardsViewFake(getHtmlSvg: () => HTMLElement) {
  return d3.select(getHtmlSvg()).select("div.cards_view_fake").node() as HTMLElement
}


/** @deprecated This export will be removed in a future version. Use setupReactiveTreeData instead. */
export function setupHtmlSvg(getHtmlSvg: () => HTMLElement) {
  d3.select(getHtmlSvg()).append("div").attr("class", "cards_view_fake").style('display', 'none')  // important for handling data
}

/** @deprecated This export will be removed in a future version. Use setupReactiveTreeData instead. */
const _setupReactiveTreeData = setupReactiveTreeData
export { _setupReactiveTreeData as setupReactiveTreeData }

/** @deprecated This export will be removed in a future version. Use setupReactiveTreeData instead. */
export function getUniqueId(d: TreeDatumComponent | { unique_id?: string }) {
  return d.unique_id
}