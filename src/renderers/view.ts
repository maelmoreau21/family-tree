import * as d3 from "d3"
import {cardToMiddle, treeFit} from "../handlers/view-handlers"
import updateLinks from "./view-links"
import updateCardsSvg from "./view-cards-svg"
import updateCardsHtml from "./view-cards-html"
import updateCardsComponent from "../features/card-component/card-component"
import { Tree } from "../layout/calculate-tree"
import { TreeDatum } from "../types/treeData"
import { LinkStyle } from "../types/store"

export interface ViewProps {
  initial?: boolean
  transition_time?: number
  cardComponent?: boolean
  cardHtml?: boolean
  cardHtmlDiv?: HTMLElement
  tree_position?: 'fit' | 'main_to_middle' | 'inherit'
  scale?: number
  link_style?: LinkStyle
}

type CardRenderer = (this: Element, datum: TreeDatum) => void
type CardComponentRenderer = (datum: TreeDatum) => HTMLElement
type CardHandler = CardRenderer | CardComponentRenderer

export default function(tree: Tree, svg: SVGElement, Card: CardHandler, props: ViewProps = {}) {
  const hasInitial = Object.prototype.hasOwnProperty.call(props, 'initial')
  const hasTransitionTime = Object.prototype.hasOwnProperty.call(props, 'transition_time')
  props.initial = hasInitial ? props.initial : !d3.select(svg.parentNode as HTMLElement).select('.card_cont').node()
  props.transition_time = hasTransitionTime ? props.transition_time : 1000
  if (props.cardComponent) updateCardsComponent(svg, tree, Card as CardComponentRenderer, props);
  else if (props.cardHtml) updateCardsHtml(svg, tree, Card as CardRenderer, props);
  else updateCardsSvg(svg, tree, Card as CardRenderer, props);
  updateLinks(svg, tree, props);

  const tree_position = props.tree_position || 'fit';
  if (props.initial) treeFit({svg, svg_dim: svg.getBoundingClientRect(), tree_dim: tree.dim, transition_time: 0})
  else if (tree_position === 'fit') treeFit({svg, svg_dim: svg.getBoundingClientRect(), tree_dim: tree.dim, transition_time: props.transition_time})
  else if (tree_position === 'main_to_middle') cardToMiddle({datum: tree.data[0], svg, svg_dim: svg.getBoundingClientRect(), scale: props.scale, transition_time: props.transition_time})
  else if (tree_position === 'inherit') {
    /* intentionally retain current viewport */
  }

  return true
}