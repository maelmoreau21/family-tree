import * as d3 from "d3"
import cardHtmlRenderer from "../../renderers/card-html"
import {processCardDisplay, CardDisplay} from "./utils"
import pathToMain from "../../layout/path-to-main"
import { Store } from "../../types/store"
import { Datum } from "../../types/data"
import { TreeDatum } from "../../types/treeData"
import type { CardDim } from "../../types/card"
import { CardHtmlSelection, LinkSelection } from "../../types/view"

export default function CardHtmlWrapper(cont: HTMLElement, store: Store) { return new CardHtml(cont, store) }
export class CardHtml {
  cont: HTMLElement
  svg: SVGElement
  store: Store
  card_display: Array<(datum: Datum) => string>
  cardImageField: string
  onCardClick: (event: Event, datum: TreeDatum) => void
  onMiniTreeClick: (event: Event, datum: TreeDatum) => void
  style: 'default' | 'imageCircleRect' | 'imageCircle' | 'imageRect' | 'rect'
  mini_tree: boolean
  onCardUpdate: ((this: HTMLElement, datum: TreeDatum) => void) | undefined
  card_dim: CardDim
  cardInnerHtmlCreator: undefined | ((d:TreeDatum) => string)
  defaultPersonIcon: undefined | ((d:TreeDatum) => string)
  onCardMouseenter: undefined | ((e:Event, d:TreeDatum) => void)
  onCardMouseleave: undefined | ((e:Event, d:TreeDatum) => void)
  to_transition: Datum['id'] | undefined | false

  constructor(cont: HTMLElement, store: Store) {
    this.cont = cont
    this.svg = this.cont.querySelector('svg.main_svg')!
    this.store = store
    this.card_display = [(d:Datum) => `${d.data["first name"]} ${d.data["last name"]}`]
    this.cardImageField = 'avatar'
  this.onCardClick = this.onCardClickDefault.bind(this)
  this.onMiniTreeClick = this.onMiniTreeClickDefault.bind(this)
    this.style = 'default'
    this.mini_tree = false
    this.card_dim = {}

    return this
  }

  private static normalizeDimKey(key: string): keyof CardDim | 'height_auto' | null {
    const aliases: Record<string, keyof CardDim> = {
      width: 'w',
      height: 'h',
      img_width: 'img_w',
      img_height: 'img_h'
    }
    const normalized = aliases[key] || key
    if (['w', 'h', 'text_x', 'text_y', 'img_w', 'img_h', 'img_x', 'img_y'].includes(normalized)) {
      return normalized as keyof CardDim
    }
    if (normalized === 'height_auto') return 'height_auto'
    return null
  }

  getCard(): (d:TreeDatum) => void {  
    return cardHtmlRenderer({
      store: this.store,
      card_display: this.card_display,
      cardImageField: this.cardImageField,
      defaultPersonIcon: this.defaultPersonIcon,
      onCardClick: this.onCardClick,
  onMiniTreeClick: this.onMiniTreeClick,
      style: this.style,
      mini_tree: this.mini_tree,
      onCardUpdate: this.onCardUpdate,
      card_dim: this.card_dim,
      empty_card_label: this.store.state.single_parent_empty_card_label || '',
      unknown_card_label: this.store.state.unknown_card_label || '',
      cardInnerHtmlCreator: this.cardInnerHtmlCreator,
      onCardMouseenter: this.onCardMouseenter ? this.onCardMouseenter.bind(this) : undefined,
      onCardMouseleave: this.onCardMouseleave ? this.onCardMouseleave.bind(this) : undefined
    })
  }

  setCardDisplay(card_display: CardDisplay) {
    this.card_display = processCardDisplay(card_display)
  
    return this
  }
  
  setCardImageField(cardImageField: CardHtml['cardImageField']) {
    this.cardImageField = cardImageField
    return this
  }
  
  setDefaultPersonIcon(defaultPersonIcon: CardHtml['defaultPersonIcon']) {
    this.defaultPersonIcon = defaultPersonIcon
    return this
  }
  
  setOnCardClick(onCardClick: CardHtml['onCardClick']) {
    this.onCardClick = onCardClick
    return this
  }
  
  setOnMiniTreeClick(onMiniTreeClick: CardHtml['onMiniTreeClick']) {
    this.onMiniTreeClick = onMiniTreeClick
    return this
  }
  
  onCardClickDefault(_event:Event, d:TreeDatum) {
    this.store.updateMainId(d.data.id)
    this.store.updateTree({})
  }

  onMiniTreeClickDefault(_event:Event, d:TreeDatum) {
    this.store.updateMainId(d.data.id)
    this.store.updateTree({ tree_position: 'main_to_middle' })
  }
  
  setStyle(style: CardHtml['style']) {
    this.style = style
    return this
  }
  
  setMiniTree(mini_tree: CardHtml['mini_tree']) {
    this.mini_tree = mini_tree
  
    return this
  }
  
  setOnCardUpdate(onCardUpdate: CardHtml['onCardUpdate']) {
    this.onCardUpdate = onCardUpdate
    return this
  }
  
  setCardDim(card_dim: Partial<CardDim> & {
    width?: number
    height?: number
    img_width?: number
    img_height?: number
  }) {
    if (!card_dim || typeof card_dim !== 'object') {
      console.error('card_dim must be an object')
      return this
    }
    Object.entries(card_dim).forEach(([rawKey, val]) => {
      const key = CardHtml.normalizeDimKey(rawKey)
      if (!key) return
      if (key === 'height_auto') {
        if (typeof val !== 'boolean') {
          console.error(`card_dim.${rawKey} must be a boolean`)
          return
        }
        this.card_dim.height_auto = val
      } else {
        if (typeof val !== 'number') {
          console.error(`card_dim.${rawKey} must be a number`)
          return
        }
        this.card_dim[key] = val
      }
    })
  
    return this
  }
  
  resetCardDim() {
    this.card_dim = {}
    return this
  }
  
  setCardInnerHtmlCreator(cardInnerHtmlCreator: CardHtml['cardInnerHtmlCreator']) {
    this.cardInnerHtmlCreator = cardInnerHtmlCreator
  
    return this
  }

  setOnHoverPathToMain() {
    this.onCardMouseenter = this.onEnterPathToMain.bind(this)
    this.onCardMouseleave = this.onLeavePathToMain.bind(this)
    return this
  }
  
  unsetOnHoverPathToMain() {
    this.onCardMouseenter = undefined
    this.onCardMouseleave = undefined
    return this
  }
  
  onEnterPathToMain(_event:Event, datum:TreeDatum) {
    this.to_transition = datum.data.id
    const main_datum = this.store.getTreeMainDatum()
    const cards: CardHtmlSelection = d3.select(this.cont).select('div.cards_view').selectAll('.card_cont')
    const links: LinkSelection = d3.select(this.cont).select('svg.main_svg .links_view').selectAll('.link')
    const {cards_node_to_main, links_node_to_main} = pathToMain(cards, links, datum, main_datum)
    cards_node_to_main.forEach(d => {
      const delay = Math.abs(datum.depth - d.card.depth) * 200
      d3.select(d.node.querySelector('div.card-inner'))
        .transition().duration(0).delay(delay)
        .on('end', () => this.to_transition === datum.data.id && d3.select(d.node.querySelector('div.card-inner')).classed('f3-path-to-main', true))
    })
    links_node_to_main.forEach(d => {
      const delay = Math.abs(datum.depth - d.link.depth) * 200
      d3.select(d.node)
        .transition().duration(0).delay(delay)
        .on('end', () => this.to_transition === datum.data.id && d3.select(d.node).classed('f3-path-to-main', true))
    })
  
    return this
  }
  
  onLeavePathToMain() {
    this.to_transition = false
    d3.select(this.cont).select('div.cards_view').selectAll('div.card-inner').classed('f3-path-to-main', false)
    d3.select(this.cont).select('svg.main_svg .links_view').selectAll('.link').classed('f3-path-to-main', false)
  
    return this
  }

}
