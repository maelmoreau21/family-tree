import * as d3 from "d3"
import {appendTemplate, CardBodyOutline, CardBodyAddNewRel, CardBody, type CardDisplayRenderer} from "./templates"
import cardElements, {appendElement} from "./elements"
import setupCardSvgDefs from "./defs"
import {plusIcon} from "../icons"
import { TreeDatum } from "../../types/treeData"
import { CardDim } from "./templates"
import { Store } from "../../types/store"
import { clearElement, updateSelectionHtml } from "../../utils/safe-html"

// todo: remove store from props
interface CardSvgProps {
  store: Store
  svg: SVGElement
  card_dim: CardDim
  card_display: CardDisplayRenderer
  onCardClick: (e: MouseEvent, d: TreeDatum) => void
  img?: boolean
  mini_tree?: boolean
  link_break?: boolean
  onMiniTreeClick?: (e: MouseEvent, d: TreeDatum) => void
  onLineBreakClick?: (e: MouseEvent, d: TreeDatum) => void
  onCardUpdate?: (d: TreeDatum) => void
}

export default function CardSvg(props: CardSvgProps) {
  props = setupProps(props);
  setupCardSvgDefs(props.svg, props.card_dim)

  return function (this: HTMLElement, d: TreeDatum) {
    const gender_class = d.data.data.gender === 'M' ? 'card-male' : d.data.data.gender === 'F' ? 'card-female' : 'card-genderless'
    const card_dim = props.card_dim

    const card = d3.create('svg:g').attr('class', `card ${gender_class}`).attr('transform', `translate(${[-card_dim.w / 2, -card_dim.h / 2]})`)
    card.append('g').attr('class', 'card-inner').attr('clip-path', 'url(#card_clip)')

    clearElement(this)
    this.appendChild(card.node()!)

    card.on("click", function (e) {
      e.stopPropagation();
      props.onCardClick.call(this, e, d)
    })

    if (d.data._new_rel_data) {
      appendTemplate(CardBodyOutline({d,card_dim,is_new:Boolean(d.data.to_add)}).template, card.node()!, true)
      const newRelLabel = d.data._new_rel_data?.label ?? ''
      appendTemplate(CardBodyAddNewRel({d,card_dim,label: newRelLabel}).template, this.querySelector('.card-inner')!, true)
      const editIcon = d3.select(this.querySelector('.card-inner'))
        .append('g')
        .attr('class', 'card-edit-icon')
        .attr('fill', 'currentColor')
        .attr('transform', `translate(-1,2)scale(${card_dim.img_h/22})`)
      updateSelectionHtml(editIcon, plusIcon(), 'CardSvg add relative icon')
    } else {
      appendTemplate(CardBodyOutline({d,card_dim,is_new:Boolean(d.data.to_add)}).template, card.node()!, true)
  appendTemplate(CardBody({d,card_dim,card_display: props.card_display}).template, this.querySelector('.card-inner')!, false)

      if (props.img) appendElement(cardElements.cardImage(d, props)!, this.querySelector('.card')!)
      if (props.mini_tree) appendElement(cardElements.miniTree(d, props)!, this.querySelector('.card')!, true)
    }

    if (props.onCardUpdate) props.onCardUpdate.call(this, d)
  }

  function setupProps(props: CardSvgProps): CardSvgProps {
    const defaultProps: Pick<CardSvgProps, 'img' | 'mini_tree' | 'link_break' | 'card_dim'> = {
      img: true,
      mini_tree: true,
      link_break: false,
      card_dim: { w: 220, h: 70, text_x: 75, text_y: 15, img_w: 60, img_h: 60, img_x: 5, img_y: 5 }
    }
    return { ...defaultProps, ...props }
  }
}

/**
 * @deprecated Use cardSvg instead. This export will be removed in a future version.
 */
export function Card(props: CardSvgProps & {store: Store}) {
  if (props.onCardClick === undefined) props.onCardClick = (_event, d) => {
    props.store.updateMainId(d.data.id)
    props.store.updateTree({})
  }
  return CardSvg(props)
}