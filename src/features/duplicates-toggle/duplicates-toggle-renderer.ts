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
  if (!Object.prototype.hasOwnProperty.call(datum, '_toggle')) return

  const card = node.querySelector('.card') as HTMLElement | null
  if (!card) return

  const cardInner = card.querySelector('.card-inner') as HTMLElement | null
  if (!cardInner) return

  const cardWidth = card.offsetWidth
  const cardHeight = card.offsetHeight

  let toggleIsOff = false
  let toggleId = -1
  const pos: { top: number; left: number } = { top: 0, left: 0 }

  if (datum.spouse) {
    const spouse = datum.spouse
    const parentId = spouse.data.main ? 'main' : spouse.parent?.data.id
    if (!parentId) return

  const toggleMap = spouse.data._tgdp_sp?.[parentId]
    if (!toggleMap) return

    toggleIsOff = toggleMap[datum.data.id] < 0
    pos.top = 60
    pos.left = (datum.sx ?? 0) - datum.x - 30 + cardWidth / 2
    if (isHorizontal) {
      pos.top = (datum.sy ?? 0) - datum.x + 4
      pos.left = cardWidth / 2 + 4
      if (Math.abs((datum.sx ?? 0) - datum.y) < 10) pos.left = cardWidth - 4
    }
    toggleId = spouse._toggle_id_sp?.[datum.data.id] ?? -1
    if (toggleId === -1) return
  } else {
    const parentId = datum.data.main ? 'main' : datum.parent?.data.id
    if (!parentId) return
  const toggleValue = datum.data._tgdp?.[parentId]
    if (toggleValue === undefined) return

    toggleIsOff = toggleValue < 0
    pos.top = -65
    pos.left = -30 + cardWidth / 2
    if (isHorizontal) {
      pos.top = 5
      pos.left = -55
    }
    toggleId = datum._toggle_id ?? -1
  }

  cardInner.style.zIndex = '1'

  const toggleDiv = d3.select(card)
    .append('div')
    .attr('class', 'f3-toggle-div')
    .attr('style', 'cursor: pointer; width: 60px; height: 60px;position: absolute; z-index: -1;')
    .style('top', `${pos.top}px`)
    .style('left', `${pos.left}px`)
    .on('click', (event: PointerEvent) => {
      event.stopPropagation()
      if (datum.spouse) {
        const spouse = datum.spouse
        const parentId = spouse.data.main ? 'main' : spouse.parent?.data.id
        if (!parentId) return

        if (!spouse.data._tgdp_sp?.[parentId]?.hasOwnProperty(datum.data.id)) {
          console.error('no toggle', datum, spouse)
          return
        }

        const existing = spouse.data._tgdp_sp[parentId][datum.data.id]
        spouse.data._tgdp_sp[parentId][datum.data.id] = existing < 0 ? Date.now() : -Date.now()
      } else {
        const parentId = datum.data.main ? 'main' : datum.parent?.data.id
        if (!parentId) return

        const map = datum.data._tgdp ?? (datum.data._tgdp = {})
        const current = map[parentId]
        map[parentId] = current < 0 ? Date.now() : -Date.now()
      }

      updateTree()
    })

  toggleDiv
    .append('div')
    .html(toggleIsOff ? toggleSvgIconOff() : toggleSvgIconOn())
    .select('svg')
    .classed('f3-toggle-icon', true)
    .style('color', toggleIsOff ? '#585656' : '#61bf52')
    .style('padding', '0')

  d3.select(card)
    .select('.f3-toggle-icon .f3-small-circle')
    .style('fill', '#fff')

  d3.select(card)
    .select('.f3-toggle-icon')
    .append('text')
    .attr('transform', toggleIsOff ? 'translate(10.6, 14.5)' : 'translate(4.1, 14.5)')
    .attr('fill', '#fff')
    .attr('font-size', '7px')
    .text(`C${toggleId}`)

  if (toggleIsOff) {
    let transform = ''
    if (datum.is_ancestry) {
      if (isHorizontal) transform = 'translate(5, -30)rotate(-90)'
      else transform = 'translate(0, -10)'
    } else {
      if (isHorizontal) transform = 'translate(11, -22)rotate(90)'
      else transform = 'translate(-7, -32)rotate(180)'
    }

    d3.select(card)
      .select('.f3-toggle-div')
      .insert('div')
      .html(miniTreeSvgIcon())
      .select('svg')
      .attr('style', 'position: absolute; z-index: -1;top: 0;left: 0;border-radius: 0;')
      .style('width', '66px')
      .style('height', '112px')
      .attr('transform', transform)
      .attr('viewBox', '0 0 72 125')
      .select('line')
      .attr('y1', datum.is_ancestry ? '62' : '92')
  }
}
