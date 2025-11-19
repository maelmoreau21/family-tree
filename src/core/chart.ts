import * as d3 from "d3"
import htmlContSetup from "../renderers/html"
import { removeToAddFromData } from "../store/edit"
import createStore from "../store/store"
import view from "../renderers/view"
import editTree, { EditTree } from "./edit"
import linkSpouseText from "../features/link-spouse-text"
import autocomplete from "../features/autocomplete"
import { getMaxDepth } from "../layout/handlers"
import { calculateKinships } from "../features/kinships/calculate-kinships"
import { getKinshipsDataStash } from "../features/kinships/kinships-data"
import { treeFit } from "../handlers/view-handlers"

import { Data, Datum } from "../types/data"
import { Store } from "../types/store"
import * as ST from "../types/store"
import cardHtml, { CardHtml } from "../core/cards/card-html"
import cardSvg, { CardSvg } from "../core/cards/card-svg"
import { TreeDatum } from "../types/treeData"
import { ViewProps } from "../renderers/view"
import { clearElement } from "../utils/safe-html"

import { KinshipInfoConfig } from "../features/kinships/calculate-kinships"
type LinkSpouseText = ((sp1: TreeDatum, sp2: TreeDatum) => string) | null
type AutocompleteInstance = ReturnType<typeof autocomplete>

export default function createChart(cont: HTMLElement | string, data: Data) {
  return new Chart(cont, data)
}

export class Chart {
  cont: HTMLElement
  store: Store
  svg: SVGElement
  getCard: null | (() => (d:TreeDatum) => void)
  is_card_html: boolean

  transition_time: number
  linkSpouseText: LinkSpouseText | null
  personSearch: AutocompleteInstance | null
  beforeUpdate: ((props?: ViewProps) => void) | null
  afterUpdate: ((props?: ViewProps) => void) | null

  editTreeInstance: EditTree | null
  linkStyle: ST.LinkStyle


  constructor(cont: HTMLElement | string, data: Data) {
    this.getCard = null
    this.transition_time = 2000
    this.linkSpouseText = null
    this.personSearch = null
  
    this.is_card_html = false
  
    this.beforeUpdate = null
    this.afterUpdate = null
    

    this.cont = setCont(cont)
    const {svg} = htmlContSetup(this.cont)
    this.svg = svg
    createNavCont(this.cont)
    const main_id = data && data.length > 0 ? data[0].id : ''
    this.store = this.createStore(data, main_id)
    if (!this.store.state.link_style) this.store.state.link_style = 'legacy'
    this.linkStyle = this.store.state.link_style
    this.setOnUpdate()

    this.editTreeInstance = null

    return this
  }

  private createStore(data: Data, main_id: Datum['id']) {
    return createStore({
      data,
      main_id,
      node_separation: 250,
      level_separation: 150,
      single_parent_empty_card: true,
      is_horizontal: false,
    })
  }

  private setOnUpdate() {
    this.store.setOnUpdate((props?: ViewProps) => {
      if (this.beforeUpdate) this.beforeUpdate(props)
      props = Object.assign({
        transition_time: this.store.state.transition_time,
        link_style: this.store.state.link_style || this.linkStyle
      }, props || {})
      if (this.is_card_html) props = Object.assign({}, props || {}, {cardHtml: true})
      view(this.store.getTree()!, this.svg, this.getCard!(), props || {})
      if (this.linkSpouseText) linkSpouseText(this.svg, this.store.getTree()!, Object.assign({}, props || {}, {linkSpouseText: this.linkSpouseText, node_separation: this.store.state.node_separation!}))
      if (this.afterUpdate) this.afterUpdate(props)
    })
  }

  setLinkStyle(link_style: ST.LinkStyle) {
    this.linkStyle = link_style
    this.store.state.link_style = link_style
    return this
  }

  updateTree(props: ViewProps = {initial: false}) {
    this.store.updateTree(props)
    return this
  }

  updateData(data: Data) {
    this.store.updateData(data)
    return this
  }

  setCardYSpacing(card_y_spacing: ST.LevelSeparation) {
    if (typeof card_y_spacing !== 'number') {
      console.error('card_y_spacing must be a number')
      return this
    }

    this.store.state.level_separation = card_y_spacing
  
    return this
  }

  setCardXSpacing(card_x_spacing: ST.NodeSeparation) {
    if (typeof card_x_spacing !== 'number') {
      console.error('card_x_spacing must be a number')
      return this
    }
    this.store.state.node_separation = card_x_spacing
  
    return this
  }

  setOrientationVertical() {
    this.store.state.is_horizontal = false
    return this
  }

  setOrientationHorizontal() {
    this.store.state.is_horizontal = true
    return this
  }

  setShowSiblingsOfMain(show_siblings_of_main: ST.ShowSiblingsOfMain) {
    this.store.state.show_siblings_of_main = show_siblings_of_main
  
    return this
  }

  setModifyTreeHierarchy(modifyTreeHierarchy: ST.ModifyTreeHierarchy) {
    this.store.state.modifyTreeHierarchy = modifyTreeHierarchy
    return this
  }
  
  setPrivateCardsConfig(private_cards_config: ST.PrivateCardsConfig) {
    this.store.state.private_cards_config = private_cards_config
  
    return this
  }
  
  setLinkSpouseText(linkSpouseText: LinkSpouseText) {
    this.linkSpouseText = linkSpouseText
  
    return this
  }

  setSingleParentEmptyCard(single_parent_empty_card: boolean, {label='Inconnu'} = {}) {
    this.store.state.single_parent_empty_card = single_parent_empty_card
    this.store.state.single_parent_empty_card_label = label
    if (this.editTreeInstance && this.editTreeInstance.addRelativeInstance.is_active) this.editTreeInstance.addRelativeInstance.onCancel!()
    removeToAddFromData(this.store.getData() || [])

    return this
  }

  setCard(card: (cont: HTMLElement, store: Store) => CardHtml | CardSvg) {
    if (card === cardHtml) return this.setCardHtml()
    else if (card === cardSvg) return this.setCardSvg()
    else throw new Error('Card must be an instance of cardHtml or cardSvg')
  }

  setCardHtml() {
    const htmlSvg = this.cont!.querySelector('#htmlSvg') as HTMLElement
    if (!htmlSvg) throw new Error('htmlSvg not found')
    this.is_card_html = true
    clearElement(this.svg.querySelector('.cards_view'))
    htmlSvg.style.display = 'block'
  
    const card = cardHtml(this.cont, this.store)
    this.getCard = () => card.getCard()

    return card
  }


  setCardSvg() {
    const htmlSvg = this.cont!.querySelector('#htmlSvg') as HTMLElement
    if (!htmlSvg) throw new Error('htmlSvg not found')
    this.is_card_html = false
    clearElement(this.svg.querySelector('.cards_view'))
    htmlSvg.style.display = 'none'

    const card = cardSvg(this.cont, this.store)
    this.getCard = () => card.getCard()

    return card
  }

  setTransitionTime(transition_time: ST.TransitionTime) {
    this.store.state.transition_time = transition_time

    return this
  }

  setSortChildrenFunction(sortChildrenFunction: ST.SortChildrenFunction) {
    this.store.state.sortChildrenFunction = sortChildrenFunction

    return this
  }

  setSortSpousesFunction(sortSpousesFunction: ST.SortSpousesFunction) {
    this.store.state.sortSpousesFunction = sortSpousesFunction

    return this
  }

  setAncestryDepth(ancestry_depth: ST.AncestryDepth) {
    if (typeof ancestry_depth === 'number' && Number.isFinite(ancestry_depth) && ancestry_depth >= 0) {
      this.store.state.ancestry_depth = ancestry_depth
    } else {
      delete this.store.state.ancestry_depth
    }

    return this
  }

  setProgenyDepth(progeny_depth: ST.ProgenyDepth) {
    if (typeof progeny_depth === 'number' && Number.isFinite(progeny_depth) && progeny_depth >= 0) {
      this.store.state.progeny_depth = progeny_depth
    } else {
      delete this.store.state.progeny_depth
    }

    return this
  }

  getMaxDepth(d_id: Datum['id']): {ancestry: number, progeny: number} {
    return getMaxDepth(d_id, this.store.getData())
  }

  calculateKinships(d_id: Datum['id'], config: KinshipInfoConfig = {}) {
    return calculateKinships(d_id, this.store.getData(), config)
  }

  getKinshipsDataStash(main_id: Datum['id'], rel_id: Datum['id']) {
    return getKinshipsDataStash(main_id, rel_id, this.store.getData(), this.calculateKinships(main_id))
  }

  setDuplicateBranchToggle(_duplicateBranchToggle?: boolean) {
    void _duplicateBranchToggle
    
    return this
  }

  editTree() {
    return this.editTreeInstance = editTree(this.cont, this.store)
  }

  updateMain(d: Datum) {
    const datumId = resolveDatumId(d)
    this.store.updateMainId(datumId)
    this.store.updateTree({})

    return this
  }

  updateMainId(id: Datum['id']) {
    this.store.updateMainId(id)

    return this
  }

  getMainDatum() {
    return this.store.getMainDatum()
  }

  setBeforeUpdate(fn: (props?: ViewProps) => void) {
    this.beforeUpdate = fn
    return this
  }

  setAfterUpdate(fn: (props?: ViewProps) => void) {
    this.afterUpdate = fn
    return this
  }

  setPersonDropdown(
    getLabel: (datum: Datum) => string,
    {
      cont=this.cont!.querySelector('.f3-nav-cont') as HTMLElement,
  onSelect,
  placeholder='Rechercher'
    } : {
      cont?: HTMLElement,
      onSelect?: (d_id: Datum['id']) => void,
      placeholder?: string
    } = {}
  ) {
    if (!onSelect) onSelect = onSelectDefault.bind(this)
    this.personSearch = autocomplete(cont, onSelect, {placeholder})

  this.personSearch.setOptionsGetterPerson(this.store.getData, getLabel)

    function onSelectDefault(this: Chart, d_id: Datum['id']) {
      const datum = this.store.getDatum(d_id)
      if (!datum) throw new Error('Datum not found')
      if (this.editTreeInstance) this.editTreeInstance.open(datum)
      this.updateMainId(d_id)
      this.updateTree({initial: false})
    }
    return this
  }




  unSetPersonSearch() {
    if (this.personSearch) {
      this.personSearch.destroy()
      this.personSearch = null
    }
    return this
  }
}


function setCont(cont: HTMLElement | string) {
  if (typeof cont === "string") cont = document.querySelector(cont) as HTMLElement
  if (!cont) throw new Error('cont not found')
  return cont
}

function createNavCont(cont: HTMLElement) {
  d3.select(cont).append('div').attr('class', 'f3-nav-cont')
}

function resolveDatumId(d: Datum): string {
  if (typeof d.id === 'string' && d.id) return d.id
  const dataId = (d.data as { id?: unknown }).id
  if (typeof dataId === 'string' && dataId) return dataId
  throw new Error('Datum id must be a non-empty string')
}