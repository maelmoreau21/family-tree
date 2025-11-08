import * as d3 from "../d3"
import {personSvgIcon, miniTreeSvgIcon, plusSvgIcon} from "./icons"
import {handleCardDuplicateToggle} from "../features/duplicates-toggle/duplicates-toggle-renderer"
import { Store } from "../types/store";
import { TreeDatum } from "../types/treeData";
import { CardDim } from "../types/card";

interface SpouseUnionDetail {
  id: string;
  name: string;
  unionDate?: string;
  unionPlace?: string;
}

export default function CardHtml(props: {
  style: 'default' | 'imageCircleRect' | 'imageCircle' | 'imageRect' | 'rect';
  cardInnerHtmlCreator?: (d: TreeDatum) => string;
  onCardClick: (e: Event, d: TreeDatum) => void;
  onCardUpdate: (d: TreeDatum) => void;
  onCardMouseenter?: (e: Event, d: TreeDatum) => void;
  onCardMouseleave?: (e: Event, d: TreeDatum) => void;
  mini_tree: boolean;
  card_dim: CardDim;
  defaultPersonIcon?: (d: TreeDatum) => string;
  empty_card_label: string;
  unknown_card_label: string;
  cardImageField: string;
  card_display: ((d: TreeDatum['data']) => string)[];
  duplicate_branch_toggle?: boolean;
  store: Store;
  onMiniTreeClick?: (e: Event, d: TreeDatum) => void;
}) {
  const cardInner = props.style === 'default' ? cardInnerDefault 
  : props.style === 'imageCircleRect' ? cardInnerImageCircleRect
  : props.style === 'imageCircle' ? cardInnerImageCircle 
  : props.style === 'imageRect' ? cardInnerImageRect
  : props.style === 'rect' ? cardInnerRect
  : cardInnerDefault

  const HTML_ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }

  function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, char => HTML_ESCAPE_MAP[char] || char)
  }

  function safeText(value: unknown) {
    if (typeof value !== 'string') return ''
    const trimmed = value.trim()
    return trimmed
  }

  function formatPersonName(source: { [key: string]: any } | undefined, fallbackId?: string) {
    if (!source) return fallbackId || ''
    const first = safeText(source['first name'])
    const last = safeText(source['last name'])
    const full = [first, last].filter(Boolean).join(' ').trim()
    if (full) return full
    const display = safeText(source.name)
    if (display) return display
    return fallbackId || ''
  }

  function collectSpouseUnionDetails(d: TreeDatum) {
    const personData = d.data?.data || {}
    const details = new Map<string, SpouseUnionDetail>()

    const registerSpouse = (id?: string, source?: { [key: string]: any }) => {
      if (!id) return
      const existing = details.get(id)
      const resolvedName = formatPersonName(source, id)
      if (existing) {
        if (!existing.name && resolvedName) existing.name = resolvedName
        return
      }
      details.set(id, {
        id,
        name: resolvedName || id
      })
    }

    if (Array.isArray(d.spouses)) {
      d.spouses.forEach(spouse => {
        const id = spouse?.data?.id
        registerSpouse(id, spouse?.data?.data)
      })
    }

    const spouseIds = Array.isArray(d.data?.rels?.spouses) ? d.data.rels.spouses : []
    spouseIds.forEach(id => {
      if (!id) return
      registerSpouse(id, props.store?.getDatum ? props.store.getDatum(id)?.data : undefined)
    })

    details.forEach(detail => {
      const dateKey = `union date__ref__${detail.id}`
      const placeKey = `union place__ref__${detail.id}`
      const unionDate = safeText(personData[dateKey])
      const unionPlace = safeText(personData[placeKey])
      if (unionDate) detail.unionDate = unionDate
      if (unionPlace) detail.unionPlace = unionPlace
    })

    return Array.from(details.values())
  }

  function renderUnionHtml(d: TreeDatum) {
    const personData = d.data?.data || {}
    const unionParagraph = safeText(personData["union paragraph"])
    const spouseDetails = collectSpouseUnionDetails(d)
    const detailHtml = spouseDetails
      .map(detail => renderUnionDetail(detail))
      .filter(Boolean) as string[]

    if (!detailHtml.length && !unionParagraph) {
      return ''
    }

    let paragraphHtml = ''
    if (unionParagraph) {
      const withBreaks = escapeHtml(unionParagraph).replace(/\r?\n/g, '<br>')
      paragraphHtml = `<p class="card-union-paragraph">${withBreaks}</p>`
    }

    return `<div class="card-union">${detailHtml.join('')}${paragraphHtml}</div>`
  }

  function renderUnionDetail(detail: SpouseUnionDetail) {
    if (!detail?.id && !detail?.name && !detail?.unionDate && !detail?.unionPlace) return ''
    const heading = escapeHtml(detail.name || detail.id)
    const lines: string[] = []
    if (detail.unionDate) {
      lines.push(`<div class="card-union-line"><strong>Date d'union :</strong> ${escapeHtml(detail.unionDate)}</div>`)
    }
    if (detail.unionPlace) {
      lines.push(`<div class="card-union-line"><strong>Lieu d'union :</strong> ${escapeHtml(detail.unionPlace)}</div>`)
    }

    return `
      <div class="card-union-item">
        <div class="card-union-heading">Union avec <strong>${heading}</strong></div>
        ${lines.join('')}
      </div>`
  }

  return function (this: HTMLElement, d: TreeDatum) {
    this.innerHTML = (`
    <div class="card ${getClassList(d).join(' ')}" data-id="${d.tid}" style="transform: translate(-50%, -50%); pointer-events: auto;">
      ${props.mini_tree ? getMiniTree(d) : ''}
      ${(props.cardInnerHtmlCreator && !d.data._new_rel_data) ? props.cardInnerHtmlCreator(d) : cardInner(d)}
    </div>
    `)
    const cardNode = this.querySelector('.card')!
    cardNode.addEventListener('click', (e: Event) => props.onCardClick(e, d))
    if (!d.data.to_add && !d.data._new_rel_data && !d.all_rels_displayed) {
      cardNode.classList.add('card-has-hidden-relatives')
    } else {
      cardNode.classList.remove('card-has-hidden-relatives')
    }

    const miniTreeNode = this.querySelector('.mini-tree') as HTMLElement | null
    if (miniTreeNode) {
      miniTreeNode.setAttribute('role', 'button')
      miniTreeNode.setAttribute('tabindex', '0')
      miniTreeNode.setAttribute('aria-label', 'Autres proches masqués – cliquer pour centrer')
      miniTreeNode.setAttribute('title', 'Autres proches masqués – cliquer pour centrer')
      miniTreeNode.dataset.hiddenRelatives = 'true'
      miniTreeNode.addEventListener('click', event => {
        event.stopPropagation()
        if (props.onMiniTreeClick) props.onMiniTreeClick(event, d)
      })
      miniTreeNode.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          if (props.onMiniTreeClick) props.onMiniTreeClick(event, d)
        }
      })
    }
    if (props.onCardUpdate) props.onCardUpdate.call(this, d)

    if (props.onCardMouseenter) d3.select(this).select('.card').on('mouseenter', e => props.onCardMouseenter!(e, d))
    if (props.onCardMouseleave) d3.select(this).select('.card').on('mouseleave', e => props.onCardMouseleave!(e, d))
    if (d.duplicate) handleCardDuplicateHover(this, d)
    if (props.duplicate_branch_toggle) {
      const isHorizontal = props.store?.state?.is_horizontal === true
      handleCardDuplicateToggle(this, d, isHorizontal, props.store.updateTree)
    }
    if (location.origin.includes('localhost')) {
      d.__node = this.querySelector('.card') as HTMLElement
      d.__label = d.data.data['first name']
      if (d.data.to_add) {
        const spouse = d.spouse || d.coparent || null
        if (spouse) d3.select(this).select('.card').attr('data-to-add', spouse.data.data['first name'])
      }
    }
  }

  function getCardInnerImageCircle(d: TreeDatum) {
    return (`
    <div class="card-inner card-image-circle" ${getCardStyle()}>
      ${d.data.data[props.cardImageField] ? `<img src="${d.data.data[props.cardImageField]}" ${getCardImageStyle()}>` : noImageIcon(d)}
      <div class="card-label">${textDisplay(d)}</div>
      ${d.duplicate ? getCardDuplicateTag(d) : ''}
    </div>
    `)
  }

  function getCardInnerImageRect(d: TreeDatum) {
    return (`
    <div class="card-inner card-image-rect" ${getCardStyle()}>
      ${d.data.data[props.cardImageField] ? `<img src="${d.data.data[props.cardImageField]}" ${getCardImageStyle()}>` : noImageIcon(d)}
      <div class="card-label">${textDisplay(d)}</div>
      ${d.duplicate ? getCardDuplicateTag(d) : ''}
    </div>
    `)
  }

  function getCardInnerRect(d: TreeDatum) {
    return (`
    <div class="card-inner card-rect" ${getCardStyle()}>
      ${textDisplay(d)}
      ${d.duplicate ? getCardDuplicateTag(d) : ''}
    </div>
    `)
  }

  function textDisplay(d: TreeDatum) {
    if (d.data._new_rel_data) return newRelDataDisplay(d)
    if (d.data.to_add) return `<div>${props.empty_card_label || 'ADD'}</div>`
    if (d.data.unknown) return `<div>${props.unknown_card_label || 'UNKNOWN'}</div>`
    const baseRows = props.card_display.map(display => `<div>${display(d.data)}</div>`).join('')
    const unionHtml = renderUnionHtml(d)
    return `${baseRows}${unionHtml}`
  }

  function newRelDataDisplay(d: TreeDatum) {
    const attr_list = []
    attr_list.push(`data-rel-type="${d.data._new_rel_data.rel_type}"`)
    if (['son', 'daughter'].includes(d.data._new_rel_data.rel_type)) attr_list.push(`data-other-parent-id="${d.data._new_rel_data.other_parent_id}"`)
    return `<div ${attr_list.join(' ')}>${d.data._new_rel_data.label}</div>`
  }

  function getMiniTree(d: TreeDatum) {
    if (!props.mini_tree) return ''
    if (d.data.to_add) return ''
    if (d.data._new_rel_data) return ''
    if (d.all_rels_displayed) return ''
    return `<div class="mini-tree">${miniTreeSvgIcon()}</div>`
  }

  function cardInnerImageCircleRect(d: TreeDatum) {
    return d.data.data[props.cardImageField] ? cardInnerImageCircle(d) : cardInnerRect(d)
  }

  function cardInnerDefault(d: TreeDatum) {
    return getCardInnerImageRect(d)
  }

  function cardInnerImageCircle(d: TreeDatum) {
    return getCardInnerImageCircle(d)
  }

  function cardInnerImageRect(d: TreeDatum) {
    return getCardInnerImageRect(d)
  }

  function cardInnerRect(d: TreeDatum) {
    return getCardInnerRect(d)
  }

  function getClassList(d: TreeDatum) {
    const class_list = []
    if (d.data.data.gender === 'M') class_list.push('card-male')
    else if (d.data.data.gender === 'F') class_list.push('card-female')
    else class_list.push('card-genderless')

    class_list.push(`card-depth-${d.is_ancestry ? -d.depth : d.depth}`)

    if (d.data.main) class_list.push('card-main')

    if (d.data._new_rel_data) class_list.push('card-new-rel')

    if (d.data.to_add) class_list.push('card-to-add')

    if (d.data.unknown) class_list.push('card-unknown')

    return class_list
  }

  function getCardStyle() {
    let style = 'style="'
    if (props.card_dim.w || props.card_dim.h) {
      style += `width: ${props.card_dim.w}px; min-height: ${props.card_dim.h}px;`
      if (props.card_dim.height_auto) style += 'height: auto;'
      else style += `height: ${props.card_dim.h}px;`
    } else {
      return ''
    }
    style += '"'
    return style
  }

  function getCardImageStyle() {
    let style = 'style="position: relative;'
    if (props.card_dim.img_w || props.card_dim.img_h || props.card_dim.img_x || props.card_dim.img_y) {
      style += `width: ${props.card_dim.img_w}px; height: ${props.card_dim.img_h}px;`
      style += `left: ${props.card_dim.img_x}px; top: ${props.card_dim.img_y}px;`
    } else {
      return ''
    }
    style += '"'
    return style
  }

  function noImageIcon(d: TreeDatum) {
    if (d.data._new_rel_data) return `<div class="person-icon" ${getCardImageStyle()}>${plusSvgIcon()}</div>`
    return `<div class="person-icon" ${getCardImageStyle()}>${props.defaultPersonIcon ? props.defaultPersonIcon(d) : personSvgIcon()}</div>`
  }

  function getCardDuplicateTag(d: TreeDatum) {
    return `<div class="f3-card-duplicate-tag">x${d.duplicate}</div>`
  }

  function handleCardDuplicateHover(node: HTMLElement, d: TreeDatum) {
    d3.select(node).on('mouseenter', e => {
      d3.select(node.closest('.cards_view')).selectAll('.card_cont').select('.card').classed('f3-card-duplicate-hover', d0 => (d0 as TreeDatum).data.id === d.data.id)
    })
    d3.select(node).on('mouseleave', e => {
      d3.select(node.closest('.cards_view')).selectAll('.card_cont').select('.card').classed('f3-card-duplicate-hover', false)
    })
  }
}
