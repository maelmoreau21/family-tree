import * as d3 from "d3"
import {cardChangeMain} from "./methods"
import {
  CardBody,
  CardImage,
  MiniTree,
  type CardDisplayRenderer,
} from "./templates"
import { Store } from "../../types/store"
import { TreeDatum } from "../../types/treeData"
import { CardDim } from "./templates"
import { updateSelectionHtml } from "../../utils/safe-html"

const CardElements = {
  miniTree,
  cardBody,
  cardImage
}
export default CardElements



function miniTree(d: TreeDatum, props: {card_dim: CardDim, onMiniTreeClick?: (e: MouseEvent, d: TreeDatum) => void, store: Store}) {
  if (d.data.to_add) return
  const card_dim = props.card_dim;
  if (d.all_rels_displayed) return
  const g = d3.create('svg:g')
  updateSelectionHtml(g, MiniTree({d,card_dim}).template, 'CardSvg mini tree')
  g.on("click", function (e) {
    e.stopPropagation();
    if (props.onMiniTreeClick) props.onMiniTreeClick.call(this, e, d)
    else cardChangeMain(props.store, {d})
  })
  return g.node()
}

function cardBody(d: TreeDatum, props: {card_dim: CardDim, onCardClick: (e: MouseEvent, d: TreeDatum) => void, store: Store, card_display: CardDisplayRenderer}) {
  const card_dim = props.card_dim;
  const g = d3.create('svg:g')
  updateSelectionHtml(g, CardBody({d, card_dim, card_display: props.card_display}).template, 'CardSvg body')
  g.on("click", function (e) {
    e.stopPropagation();
    if (props.onCardClick) props.onCardClick.call(this, e, d)
    else cardChangeMain(props.store, {d})
  })

  return g.node()
}

function cardImage(d: TreeDatum, props: {card_dim: CardDim, store: Store}) {
  if (d.data.to_add) return
  const card_dim = props.card_dim;
  const avatar = typeof d.data.data.avatar === "string" ? d.data.data.avatar : ""
  const g = d3.create('svg:g')
  updateSelectionHtml(g, CardImage({d, image: avatar, card_dim, maleIcon: undefined, femaleIcon: undefined}).template, 'CardSvg image')
  return g.node()
}

export function appendElement(el_maybe: Element, parent: Element, is_first: boolean = false) {
  if (!el_maybe) return
  if (is_first) parent.insertBefore(el_maybe, parent.firstChild)
  else parent.appendChild(el_maybe)
}
