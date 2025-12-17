import * as f3 from '/lib/family-tree.esm.js'
import { initTabs } from '../../src/utils/tabs'

// Polyfill for structuredClone if missing (or strictly for safe deep cloning)
window.structuredCloneSafe = function (val) {
  if (typeof window.structuredClone === 'function') {
    return window.structuredClone(val)
  }
  return JSON.parse(JSON.stringify(val))
}

const statusEl = document.getElementById('status')
const saveBtn = document.getElementById('save')
const reloadBtn = document.getElementById('reload')
const panel = document.getElementById('controlPanel')
const chartSelector = '#FamilyChart'
const searchRoot = document.querySelector('[data-role="builder-search"]')
const searchTarget = document.querySelector('[data-role="builder-search-target"]')
const searchEmptyEl = document.querySelector('[data-role="builder-search-empty"]')
const searchLabel = document.getElementById('builderSearchLabel')
const searchHint = document.getElementById('builderSearchHint')
const panelToggleBtn = document.querySelector('[data-action="toggle-panel"]')
const breadcrumbRoot = document.querySelector('[data-role="builder-breadcrumbs"]')
const chartLoadingEl = document.querySelector('[data-role="chart-loading"]')
const chartLoadingLabel = chartLoadingEl?.querySelector('[data-role="chart-loading-label"]') || null

const CONTROL_PANEL_STATE_KEY = 'family-tree:builder:controlsCollapsed'
let builderSearchOptions = []
let builderSearchReady = false
let builderSearchInput = null
let searchFocusTimer = null
let chartLoadingHideTimer = null
let setMainProfileHandler = null
let activeChartInstance = null
let activeHighlightedCard = null
let cardHighlightTimer = null
let pendingHighlightId = null
let ignoreNextMainSync = false
let transientMainSelection = false

function clearElement(target) {
  if (!target) return
  while (target.firstChild) {
    target.removeChild(target.firstChild)
  }
}

function setBuilderSearchState(state) {
  if (!searchRoot) return
  if (!state) {
    delete searchRoot.dataset.state
    return
  }
  searchRoot.dataset.state = state
}

function normalizeFieldKey(value) {
  if (value === undefined || value === null) return ''
  return String(value).trim().toLowerCase()
}

function sanitizeFieldValues(values) {
  if (!Array.isArray(values)) return []
  const seen = new Set()
  const result = []
  values.forEach(rawValue => {
    if (typeof rawValue !== 'string') return
    const trimmed = rawValue.trim()
    if (!trimmed) return
    const key = normalizeFieldKey(trimmed)
    if (seen.has(key)) return
    seen.add(key)
    result.push(trimmed)
  })
  return result
}

function cssEscape(value) {
  if (value === null || value === undefined) return ''
  if (window.CSS?.escape) {
    try {
      return window.CSS.escape(String(value))
    } catch (error) {
      /* fall through */
    }
  }
  return String(value).replace(/[^a-zA-Z0-9_-]/g, char => `\\${char} `)
}

function requestSetMainProfile(id, options) {
  if (!id) return
  if (typeof setMainProfileHandler === 'function') {
    setMainProfileHandler(id, options)
  }
}

function setSearchPanelFocusState(active) {
  if (!searchRoot) return
  searchRoot.classList.toggle('is-focused', Boolean(active))
}

function flashSearchPanel() {
  if (!searchRoot) return
  searchRoot.classList.add('is-flashing')
  if (searchFocusTimer) {
    clearTimeout(searchFocusTimer)
  }
  searchFocusTimer = setTimeout(() => {
    searchRoot.classList.remove('is-flashing')
  }, 1200)
}

function focusBuilderSearch({ label, select = true, flash = false, preventScroll = false } = {}) {
  if (!builderSearchInput) return
  if (typeof label === 'string') {
    builderSearchInput.value = label
  }
  try {
    builderSearchInput.focus({ preventScroll })
  } catch (error) {
    builderSearchInput.focus()
  }
  if (select && typeof builderSearchInput.select === 'function') {
    builderSearchInput.select()
  }
  setSearchPanelFocusState(true)
  if (flash) {
    flashSearchPanel()
  }
}

function setChartLoading(isLoading, message = '') {
  if (!chartLoadingEl) return
  if (chartLoadingHideTimer) {
    clearTimeout(chartLoadingHideTimer)
    chartLoadingHideTimer = null
  }
  if (isLoading) {
    chartLoadingEl.classList.remove('is-hidden')
    chartLoadingEl.setAttribute('aria-hidden', 'false')
    if (chartLoadingLabel) {
      chartLoadingLabel.textContent = message || 'Chargementâ€¦'
    }
  } else {
    const hide = () => {
      chartLoadingEl.classList.add('is-hidden')
      chartLoadingEl.setAttribute('aria-hidden', 'true')
    }
    chartLoadingHideTimer = setTimeout(hide, 150)
  }
}

function getCardElementByPersonId(personId) {
  if (!personId || !activeChartInstance?.store?.getTreeDatum) return null
  const treeDatum = activeChartInstance.store.getTreeDatum(personId)
  const tid = treeDatum?.tid
  if (!tid) return null
  const container = activeChartInstance.cont || document.querySelector(chartSelector)
  if (!container) return null
  const selector = `.card[data-id="${cssEscape(tid)}"]`
  return container.querySelector(selector)
}

function applyCardHighlight(cardEl, { animate = true } = {}) {
  if (!cardEl) return
  if (activeHighlightedCard && activeHighlightedCard !== cardEl) {
    activeHighlightedCard.classList.remove('card-highlight')
    activeHighlightedCard.classList.remove('card-highlight-pulse')
  }
  cardEl.classList.add('card-highlight')
  cardEl.classList.toggle('card-highlight-pulse', Boolean(animate))
  if (cardHighlightTimer) {
    clearTimeout(cardHighlightTimer)
  }
  if (animate) {
    cardHighlightTimer = setTimeout(() => {
      cardEl.classList.remove('card-highlight-pulse')
    }, 1400)
  }
  activeHighlightedCard = cardEl
}

function highlightCardById(personId, { animate = true } = {}) {
  pendingHighlightId = personId || null
  if (!personId) return
  const cardEl = getCardElementByPersonId(personId)
  if (cardEl) {
    applyCardHighlight(cardEl, { animate })
    return
  }
  requestAnimationFrame(() => {
    if (pendingHighlightId === personId) {
      const nextEl = getCardElementByPersonId(personId)
      if (nextEl) {
        applyCardHighlight(nextEl, { animate })
      }
    }
  })
}

function scrollCardIntoView(personId) {
  const cardEl = getCardElementByPersonId(personId)
  if (!cardEl) return false
  try {
    cardEl.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
  } catch (error) {
    try {
      cardEl.scrollIntoView({ block: 'center', inline: 'center' })
    } catch (innerError) {
      /* ignore */
    }
  }
  return true
}

function focusChartOnPerson(personId, { persistSelection = false, treePosition = 'main_to_middle' } = {}) {
  if (!personId || !activeChartInstance) return false
  const chart = activeChartInstance
  const storeMainId = chart.store?.getMainId?.() || null
  const canUpdateMain = typeof chart.updateMainId === 'function'
  const shouldUpdateMain = canUpdateMain && storeMainId !== personId

  if (shouldUpdateMain && !persistSelection) {
    transientMainSelection = true
    ignoreNextMainSync = true
  } else if (persistSelection) {
    transientMainSelection = false
  }

  if (shouldUpdateMain && canUpdateMain) {
    chart.updateMainId(personId)
  }

  if (typeof chart.updateTree === 'function') {
    chart.updateTree({ initial: false, tree_position: treePosition })
  }

  return true
}

function activateProfileInteraction(personId, {
  openEditor = true,
  highlightCard = true,
  focusSearch = false,
  searchLabel = null,
  flashSearch = false,
  preventSearchScroll = false,
  scrollCard = true,
  persistChartSelection = false
} = {}) {
  if (!personId) return
  const datum = editTreeInstance?.store?.getDatum?.(personId) || null
  focusChartOnPerson(personId, { persistSelection: persistChartSelection })
  if (highlightCard) {
    highlightCardById(personId, { animate: true })
  }
  if (scrollCard) {
    scrollCardIntoView(personId)
  }
  if (focusSearch) {
    const label = searchLabel || (datum ? buildPersonLabel(datum) : null)
    if (label) {
      focusBuilderSearch({ label, select: true, flash: flashSearch, preventScroll: preventSearchScroll })
    }
  }
  if (openEditor && datum && editTreeInstance) {
    editTreeInstance.open(datum)
  }
}

function renderBreadcrumbTrail(mainId) {
  if (!breadcrumbRoot) return
  breadcrumbRoot.dataset.state = mainId ? 'ready' : 'empty'
  clearElement(breadcrumbRoot)
  if (!mainId || !activeChartInstance?.store?.getTreeDatum) {
    const placeholder = document.createElement('span')
    placeholder.className = 'breadcrumb-empty'
    placeholder.textContent = 'SÃ©lectionnez une personne pour afficher son parcours.'
    breadcrumbRoot.append(placeholder)
    return
  }

  const nodes = []
  const seen = new Set()
  let current = activeChartInstance.store.getTreeDatum(mainId) || null
  while (current && !seen.has(current)) {
    nodes.push(current)
    seen.add(current)
    current = current.parent || null
  }
  nodes.reverse()

  if (!nodes.length) {
    breadcrumbRoot.dataset.state = 'empty'
    const placeholder = document.createElement('span')
    placeholder.className = 'breadcrumb-empty'
    placeholder.textContent = 'Parcours indisponible pour ce profil.'
    breadcrumbRoot.append(placeholder)
    return
  }

  nodes.forEach((node, index) => {
    const personId = node?.data?.id
    const label = buildPersonLabel(node?.data || node)
    const isActive = index === nodes.length - 1
    const element = document.createElement(isActive ? 'span' : 'button')
    element.className = 'breadcrumb-item'
    if (isActive) {
      element.classList.add('is-active')
      element.textContent = label
    } else {
      element.type = 'button'
      element.textContent = label
      element.addEventListener('click', () => {
        activateProfileInteraction(personId, { openEditor: false })
      })
    }
    breadcrumbRoot.append(element)
  })
}

function escapeHtml(input) {
  if (input === null || input === undefined) return ''
  return String(input).replace(/[&<>"'`]/g, (char) => {
    switch (char) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#39;'
      case '`': return '&#96;'
      default: return char
    }
  })
}

function getStorageSafe() {
  try {
    return window.localStorage
  } catch (error) {
    return null
  }
}

function readCollapsedState() {
  const storage = getStorageSafe()
  // Default to collapsed (hidden) unless the user explicitly stored a different state.
  // If localStorage is unavailable, assume collapsed so the panel stays hidden by default.
  if (!storage) return true
  try {
    const val = storage.getItem(CONTROL_PANEL_STATE_KEY)
    if (val === null) return true
    return val === '1'
  } catch (error) {
    return true
  }
}

function writeCollapsedState(collapsed) {
  const storage = getStorageSafe()
  if (!storage) return
  try {
    if (collapsed) {
      storage.setItem(CONTROL_PANEL_STATE_KEY, '1')
    } else {
      storage.removeItem(CONTROL_PANEL_STATE_KEY)
    }
  } catch (error) {
  }
}

function applyControlsCollapsedState(collapsed) {
  if (collapsed) {
    document.body.classList.add('controls-collapsed')
  } else {
    document.body.classList.remove('controls-collapsed')
  }

  if (panelToggleBtn) {
    panelToggleBtn.setAttribute('aria-expanded', String(!collapsed))
    const span = panelToggleBtn.querySelector('span')
    if (span) {
      span.textContent = collapsed ? 'Afficher' : 'Masquer'
    } else {
      // Fallback if span is missing (though we added it)
      panelToggleBtn.title = collapsed ? 'Afficher le panneau' : 'Masquer le panneau'
    }
  }
}

function toggleControlsCollapsed(force) {
  const next = typeof force === 'boolean' ? force : !document.body.classList.contains('controls-collapsed')
  applyControlsCollapsedState(next)
  writeCollapsedState(next)
}

const initialPanelCollapsed = readCollapsedState()
applyControlsCollapsedState(initialPanelCollapsed)
if (panelToggleBtn) {
  panelToggleBtn.addEventListener('click', () => {
    toggleControlsCollapsed()
  })
}

const DISPLAY_FIELD_LABELS = new Map([
  ['first name', 'Prénom'],
  ['first names', 'Prénoms'],
  ['last name', 'Nom'],
  ['birthday', 'Date de naissance'],
  ['death', 'Date de Décès'],
  ['gender', 'Genre'],
  ['avatar', 'Photo de profil'],
  ['photo', 'Photo'],
  ['picture', 'Portrait'],
  ['bio', 'Biographie'],
  ['metiers', 'Métiers'],
  ['nationality', 'Nationalité'],
  ['occupation', 'Profession'],
  ['location', 'Lieu de résidence'],
  ['birthplace', 'Lieu de naissance'],
  ['deathplace', 'Lieu de décès'],
  ['union date', "Date d'union"],
  ['union place', "Lieu d'union"],
  ['union paragraph', "Paragraphe d'union"],
  ['notes', 'Notes'],
  ['nickname', 'Surnom'],
  ['maiden name', 'Nom de naissance']
])

const HIDDEN_FIELD_KEYS = new Set([
  'phone',
  'email',
  'notes',
  'occupation',
  'location',
  'residence',
  'nickname'
])

const DISPLAY_DEFAULTS = {
  1: [
    { value: 'first name', checked: true },
    { value: 'last name', checked: true },
    { value: 'birthday', checked: false },
    { value: 'avatar', checked: false },
    { value: 'gender', checked: false }
  ],
  2: [
    { value: 'birthday', checked: true },
    { value: 'death', label: 'Date de Décès', checked: false },
    { value: 'avatar', checked: false },
    { value: 'gender', checked: false }
  ]
}

const EDITABLE_DEFAULTS = [
  { value: 'first name', label: 'Prénom', checked: true },
  { value: 'first names', label: 'Prénoms', checked: true },
  { value: 'last name', label: 'Nom', checked: true },
  { value: 'maiden name', label: 'Nom de naissance', checked: true },
  { value: 'birthday', label: 'Date de naissance', checked: true },
  { value: 'death', label: 'Date de Décès', checked: true },
  { value: 'birthplace', label: 'Lieu de naissance', checked: true },
  { value: 'deathplace', label: 'Lieu de Décès', checked: true },
  { value: 'avatar', label: 'Avatar', checked: true },
  { value: 'gender', label: 'Genre', checked: true },
  { value: 'nationality', label: 'Nationalité', checked: true },
  { value: 'metiers', label: 'Métiers', checked: true },
  { value: 'bio', label: 'Biographie', checked: false }
]

const DEFAULT_CARD_DISPLAY = [
  ['first name', 'last name'],
  ['birthday']
]

const UNION_PARAGRAPH_KEY = 'union paragraph'

const DEFAULT_EDITABLE_FIELDS = sanitizeFieldValues(
  EDITABLE_DEFAULTS
    .filter(def => def.checked !== false)
    .map(def => def.value)
)

const TEXTAREA_FIELD_KEYS = new Set(['bio', 'notes', 'biographie', 'description'])
const UNION_FIELD_SPECS = [
  { key: 'union date', kind: 'date' },
  { key: 'union place', kind: 'place' }
]

function getUnionFieldKind(value) {
  if (value === undefined || value === null) return null
  const normalized = normalizeFieldKey(value)
  if (!normalized) return null
  const cleaned = normalized.replace(/[^a-z]+/g, '')
  if (cleaned === 'uniondate' || (normalized.startsWith('union') && normalized.includes('date'))) {
    return 'date'
  }
  if (cleaned === 'unionplace' || (normalized.startsWith('union') && normalized.includes('place'))) {
    return 'place'
  }
  return null
}

function createFieldDescriptor(key, value, label) {
  if (getUnionFieldKind(key)) {
    return {
      id: value,
      label,
      type: 'rel_reference',
      rel_type: 'spouse',
      getRelLabel: buildPersonLabel
    }
  }
  const type = TEXTAREA_FIELD_KEYS.has(key) ? 'textarea' : 'text'
  return { id: value, label, type }
}

function appendUnionFieldDescriptors(descriptors, labelLookup) {
  const getLabel = (key) => {
    if (!labelLookup) return key
    if (typeof labelLookup.get === 'function') {
      return labelLookup.get(key) || key
    }
    if (labelLookup instanceof Map) {
      return labelLookup.get(key) || key
    }
    return labelLookup[key] || key
  }

  UNION_FIELD_SPECS.forEach(({ key, kind }) => {
    const exists = descriptors.some(descriptor => getUnionFieldKind(descriptor.id) === kind)
    if (exists) return
    const label = getLabel(key)
    descriptors.push(createFieldDescriptor(key, key, label))
  })

  return descriptors
}

function createBaseFieldLabelStore() {
  const store = new Map(DISPLAY_FIELD_LABELS)
  EDITABLE_DEFAULTS.forEach(def => {
    store.set(normalizeFieldKey(def.value), def.label)
  })
  Object.values(DISPLAY_DEFAULTS).forEach(defs => {
    defs.forEach(def => {
      if (def.label) {
        store.set(normalizeFieldKey(def.value), def.label)
      }
    })
  })
  return store
}

function buildFieldDescriptors(fields, labelStore = createBaseFieldLabelStore()) {
  const store = labelStore || createBaseFieldLabelStore()
  const descriptors = sanitizeFieldValues(fields).map(value => {
    const key = normalizeFieldKey(value)
    const label = store.get(key) || value
    return createFieldDescriptor(key, value, label)
  })
  return appendUnionFieldDescriptors(descriptors, store)
}

function safeTrim(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getAllPersons() {
  if (!editTreeInstance || !editTreeInstance.store || typeof editTreeInstance.store.getData !== 'function') {
    return []
  }
  const persons = editTreeInstance.store.getData()
  return Array.isArray(persons) ? persons : []
}

function buildPersonLabel(datum) {
  if (!datum) return 'Profil sans nom'
  const person = datum.data || {}
  const first = safeTrim(person['first name'])
  const last = safeTrim(person['last name'])
  const base = (first || last) ? [first, last].filter(Boolean).join(' ').trim() : `Profil ${datum.id}`
  return base || 'Profil sans nom'
}

function createSearchOptionFromDatum(datum) {
  if (!datum || typeof datum.id !== 'string' || !datum.id.trim()) return null
  const label = buildPersonLabel(datum)
  const tokens = new Set()
  const metaParts = []
  const metaSeen = new Set()

  const addToken = (value) => {
    if (typeof value !== 'string') return
    const trimmed = value.trim()
    if (!trimmed) return
    tokens.add(trimmed)
  }

  const addMeta = (value) => {
    if (typeof value !== 'string') return
    const trimmed = value.trim()
    if (!trimmed || metaSeen.has(trimmed)) return
    metaSeen.add(trimmed)
    metaParts.push(trimmed)
  }

  addToken(label)
  addToken(String(datum.id))

  const person = datum.data && typeof datum.data === 'object' ? datum.data : {}
  Object.entries(person).forEach(([rawKey, rawValue]) => {
    if (typeof rawValue !== 'string') return
    const trimmed = rawValue.trim()
    if (!trimmed) return
    addToken(trimmed)
    const key = normalizeFieldKey(rawKey)
    if (key === 'birthday') {
      addMeta(trimmed)
      return
    }
    if (key === 'death') {
      addMeta(`âœ ${trimmed}`)
      return
    }
    if (key === 'maiden name') {
      addMeta(`(${trimmed})`)
      return
    }
    if (key === 'occupation') {
      addMeta(trimmed)
      return
    }
    if (key === 'location' || key === 'residence' || key === 'birthplace' || key === 'deathplace') {
      addMeta(trimmed)
    }
  })

  const searchText = Array.from(tokens)
    .map(value => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' | ')

  return {
    label,
    value: datum.id,
    searchText,
    optionHtml: (option) => {
      const safeMetaParts = metaParts.map(part => escapeHtml(part))
      const meta = safeMetaParts.length ? `<small>${safeMetaParts.join(' Â· ')}</small>` : ''
      const safeLabel = option.label_html || escapeHtml(option.label)
      return `<div>${safeLabel}${meta ? `<div class="f3-autocomplete-meta">${meta}</div>` : ''}</div>`
    }
  }
}

function buildSearchOptionsFromPersons(persons) {
  if (!Array.isArray(persons)) return []
  const options = []
  const seen = new Set()
  persons.forEach(datum => {
    if (!datum || !datum.id || seen.has(datum.id)) return
    const option = createSearchOptionFromDatum(datum)
    if (!option) return
    options.push(option)
    seen.add(datum.id)
  })
  options.sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))
  return options
}

function initBuilderSearch(chart) {
  if (!chart || !searchTarget) {
    setBuilderSearchState('empty')
    return null
  }

  if (searchEmptyEl) {
    searchEmptyEl.classList.remove('hidden')
  }

  chart.setPersonDropdown(
    (datum) => buildPersonLabel(datum),
    {
      cont: searchTarget,
      placeholder: 'Rechercher (nom, date, lieu, etc.)',
      onSelect: (id) => {
        if (!id) return
        const datum = editTreeInstance?.store?.getDatum?.(id)
        if (!datum) return

        activateProfileInteraction(id, {
          openEditor: true,
          highlightCard: true,
          focusSearch: false,
          scrollCard: true
        })




        try {
          const input = searchTarget.querySelector('input')
          if (input) {
            input.value = ''
            input.blur()
          }
        } catch (e) {
        }
      }
    }
  )

  const input = searchTarget.querySelector('input')
  if (input) {
    input.setAttribute('id', 'builderSearchInput')
    if (searchLabel) input.setAttribute('aria-labelledby', searchLabel.id)
    if (searchHint) input.setAttribute('aria-describedby', searchHint.id)
    input.setAttribute('autocomplete', 'off')
    input.setAttribute('spellcheck', 'false')
    builderSearchInput = input
    builderSearchInput.addEventListener('focus', () => setSearchPanelFocusState(true))
    builderSearchInput.addEventListener('blur', () => setSearchPanelFocusState(false))
  }

  function refreshSearchOptions() {
    if (!chart.personSearch) return
    const persons = getAllPersons()
    builderSearchOptions = buildSearchOptionsFromPersons(persons)
    chart.personSearch.setOptionsGetter(() => builderSearchOptions)
    setBuilderSearchState(builderSearchOptions.length ? 'ready' : 'empty')
    builderSearchReady = true
  }

  refreshSearchOptions()

  return {
    refreshSearchOptions
  }
}

const DEFAULT_CHART_CONFIG = Object.freeze({
  transitionTime: 320,
  cardXSpacing: 240,
  cardYSpacing: 140,
  orientation: 'vertical',
  showSiblingsOfMain: true,
  singleParentEmptyCard: true,
  singleParentEmptyCardLabel: 'Inconnu',
  ancestryDepth: 4,
  progenyDepth: 4,
  miniTree: true,
  linkStyle: 'legacy',
  editableFields: [...DEFAULT_EDITABLE_FIELDS],
  cardDisplay: DEFAULT_CARD_DISPLAY.map(row => [...row]),
  mainId: null
})

function normalizeCardDisplay(rows) {
  const safeRows = Array.isArray(rows) ? rows : []
  const normalized = safeRows.slice(0, 2).map(row => sanitizeFieldValues(Array.isArray(row) ? row : []))
  while (normalized.length < 2) normalized.push([])
  return normalized
}

function cloneCardDisplay(cardDisplay, fallbackRows = DEFAULT_CARD_DISPLAY) {
  let source = cardDisplay
  if (cardDisplay && !Array.isArray(cardDisplay) && typeof cardDisplay === 'object') {
    source = [
      cardDisplay[0] ?? cardDisplay['0'] ?? cardDisplay.row1 ?? cardDisplay.row_1 ?? cardDisplay.ligne1 ?? cardDisplay.line1 ?? cardDisplay.first ?? [],
      cardDisplay[1] ?? cardDisplay['1'] ?? cardDisplay.row2 ?? cardDisplay.row_2 ?? cardDisplay.ligne2 ?? cardDisplay.line2 ?? cardDisplay.second ?? []
    ]
  }

  if (!Array.isArray(source)) {
    return fallbackRows.map(row => [...row])
  }

  const normalized = normalizeCardDisplay(source)
  return normalized.map((row, index) => {
    if (row.length) return [...row]
    const fallback = fallbackRows[index]
    return Array.isArray(fallback) ? [...fallback] : []
  })
}

function buildChartConfig(overrides = {}) {
  const base = {
    transitionTime: DEFAULT_CHART_CONFIG.transitionTime,
    cardXSpacing: DEFAULT_CHART_CONFIG.cardXSpacing,
    cardYSpacing: DEFAULT_CHART_CONFIG.cardYSpacing,
    orientation: DEFAULT_CHART_CONFIG.orientation,
    showSiblingsOfMain: DEFAULT_CHART_CONFIG.showSiblingsOfMain,
    singleParentEmptyCard: DEFAULT_CHART_CONFIG.singleParentEmptyCard,
    singleParentEmptyCardLabel: DEFAULT_CHART_CONFIG.singleParentEmptyCardLabel,
    ancestryDepth: DEFAULT_CHART_CONFIG.ancestryDepth,
    progenyDepth: DEFAULT_CHART_CONFIG.progenyDepth,
    miniTree: DEFAULT_CHART_CONFIG.miniTree,
    linkStyle: DEFAULT_CHART_CONFIG.linkStyle,

    editableFields: [...DEFAULT_EDITABLE_FIELDS],
    cardDisplay: cloneCardDisplay(DEFAULT_CARD_DISPLAY),
    mainId: DEFAULT_CHART_CONFIG.mainId
  }

  if (typeof overrides.transitionTime === 'number' && Number.isFinite(overrides.transitionTime)) {
    base.transitionTime = overrides.transitionTime
  }

  if (typeof overrides.cardXSpacing === 'number' && Number.isFinite(overrides.cardXSpacing)) {
    base.cardXSpacing = overrides.cardXSpacing
  }

  if (typeof overrides.cardYSpacing === 'number' && Number.isFinite(overrides.cardYSpacing)) {
    base.cardYSpacing = overrides.cardYSpacing
  }

  if (overrides.orientation === 'horizontal' || overrides.orientation === 'vertical') {
    base.orientation = overrides.orientation
  }

  if (typeof overrides.showSiblingsOfMain === 'boolean') {
    base.showSiblingsOfMain = overrides.showSiblingsOfMain
  }

  if (typeof overrides.singleParentEmptyCard === 'boolean') {
    base.singleParentEmptyCard = overrides.singleParentEmptyCard
  }

  if (typeof overrides.singleParentEmptyCardLabel === 'string') {
    const trimmed = overrides.singleParentEmptyCardLabel.trim()
    if (trimmed) base.singleParentEmptyCardLabel = trimmed
  }

  if (overrides.ancestryDepth === null) {
    base.ancestryDepth = null
  } else if (typeof overrides.ancestryDepth === 'number' && Number.isFinite(overrides.ancestryDepth) && overrides.ancestryDepth >= 0) {
    base.ancestryDepth = Math.floor(overrides.ancestryDepth)
  }

  if (overrides.progenyDepth === null) {
    base.progenyDepth = null
  } else if (typeof overrides.progenyDepth === 'number' && Number.isFinite(overrides.progenyDepth) && overrides.progenyDepth >= 0) {
    base.progenyDepth = Math.floor(overrides.progenyDepth)
  }

  if (typeof overrides.miniTree === 'boolean') {
    base.miniTree = overrides.miniTree
  }

  const rawLinkStyle = overrides.linkStyle ?? overrides.link_style
  if (rawLinkStyle === 'legacy' || rawLinkStyle === 'smooth') {
    base.linkStyle = rawLinkStyle
  }


  if (Array.isArray(overrides.editableFields)) {
    const sanitizedEditable = sanitizeFieldValues(overrides.editableFields)
    if (sanitizedEditable.length) {
      base.editableFields = sanitizedEditable
    }
  }

  if (Array.isArray(overrides.cardDisplay) || (overrides.cardDisplay && typeof overrides.cardDisplay === 'object')) {
    base.cardDisplay = cloneCardDisplay(overrides.cardDisplay, [[], []])
  }

  if (typeof overrides.mainId === 'string') {
    const trimmed = overrides.mainId.trim()
    if (trimmed) base.mainId = trimmed
  }

  return base
}

let editTreeInstance = null
let autoSaveTimer = null
let lastSnapshotString = null
let isSaving = false
let queuedSave = null
let chartConfig = buildChartConfig()
let isApplyingConfig = false
let currentEditableFields = [...DEFAULT_EDITABLE_FIELDS]
let activePanelTeardown = null

function setStatus(message, type = 'info') {
  if (!statusEl) return
  try {
    if (typeof message === 'string') {

      statusEl.innerHTML = message.replace(/\n/g, '<br>')
    } else if (Array.isArray(message)) {
      statusEl.innerHTML = message.map(m => String(m)).join('<br>')
    } else {
      statusEl.textContent = String(message)
    }
  } catch (e) {

    statusEl.textContent = String(message)
  }
  statusEl.dataset.status = type
}

function normaliseTreePayload(payload) {
  if (Array.isArray(payload)) {
    return { data: payload, config: {} }
  }

  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.data)) {
      const candidateConfig = payload.config || payload.settings || payload.meta || {}
      return { data: payload.data, config: candidateConfig }
    }

    if (Array.isArray(payload.tree)) {
      const candidateConfig = payload.config || payload.settings || payload.meta || {}
      return { data: payload.tree, config: candidateConfig }
    }
  }

  return { data: [], config: {} }
}

function normaliseChartConfig(rawConfig = {}) {
  if (!rawConfig || typeof rawConfig !== 'object') return {}

  const config = {}

  const transition = rawConfig.transitionTime ?? rawConfig.transition_time
  if (typeof transition === 'number' && Number.isFinite(transition)) {
    config.transitionTime = transition
  }

  const cardX = rawConfig.cardXSpacing ?? rawConfig.card_x_spacing ?? rawConfig.node_separation
  if (typeof cardX === 'number' && Number.isFinite(cardX)) {
    config.cardXSpacing = cardX
  }

  const cardY = rawConfig.cardYSpacing ?? rawConfig.card_y_spacing ?? rawConfig.level_separation
  if (typeof cardY === 'number' && Number.isFinite(cardY)) {
    config.cardYSpacing = cardY
  }

  const orientation = rawConfig.orientation
  if (orientation === 'horizontal' || orientation === 'vertical') {
    config.orientation = orientation
  } else if (typeof rawConfig.is_horizontal === 'boolean') {
    config.orientation = rawConfig.is_horizontal ? 'horizontal' : 'vertical'
  }

  const showSiblings = rawConfig.showSiblingsOfMain ?? rawConfig.show_siblings_of_main
  if (typeof showSiblings === 'boolean') {
    config.showSiblingsOfMain = showSiblings
  }

  const singleParentEnabled = rawConfig.singleParentEmptyCard ?? rawConfig.single_parent_empty_card
  if (typeof singleParentEnabled === 'boolean') {
    config.singleParentEmptyCard = singleParentEnabled
  }

  const emptyLabel = rawConfig.singleParentEmptyCardLabel ?? rawConfig.single_parent_empty_card_label
  if (typeof emptyLabel === 'string' && emptyLabel.trim().length > 0) {
    config.singleParentEmptyCardLabel = emptyLabel.trim()
  }

  const editableFields = rawConfig.editableFields ?? rawConfig.edit_fields ?? rawConfig.fields ?? rawConfig.editable_fields
  if (Array.isArray(editableFields)) {
    config.editableFields = sanitizeFieldValues(editableFields)
  }

  const rawCardDisplay = rawConfig.cardDisplay ?? rawConfig.card_display
  if (Array.isArray(rawCardDisplay) || (rawCardDisplay && typeof rawCardDisplay === 'object')) {
    config.cardDisplay = cloneCardDisplay(rawCardDisplay, [[], []])
  }

  const rawMainId = rawConfig.mainId ?? rawConfig.main_id ?? rawConfig.mainPersonId ?? rawConfig.main_person_id
  if (typeof rawMainId === 'string' && rawMainId.trim().length > 0) {
    config.mainId = rawMainId.trim()
  }

  const rawAncestryDepth = rawConfig.ancestryDepth ?? rawConfig.ancestry_depth
  if (rawAncestryDepth === null) {
    config.ancestryDepth = null
  } else if (rawAncestryDepth !== undefined) {
    const value = Number(rawAncestryDepth)
    if (Number.isFinite(value) && value >= 0) {
      config.ancestryDepth = Math.floor(value)
    }
  }

  const rawProgenyDepth = rawConfig.progenyDepth ?? rawConfig.progeny_depth
  if (rawProgenyDepth === null) {
    config.progenyDepth = null
  } else if (rawProgenyDepth !== undefined) {
    const value = Number(rawProgenyDepth)
    if (Number.isFinite(value) && value >= 0) {
      config.progenyDepth = Math.floor(value)
    }
  }

  const rawMiniTree = rawConfig.miniTree ?? rawConfig.mini_tree
  if (typeof rawMiniTree === 'boolean') {
    config.miniTree = rawMiniTree
  }



  return config
}

function applyChartConfigToChart(chart) {
  chart.setTransitionTime(chartConfig.transitionTime)
  chart.setCardXSpacing(chartConfig.cardXSpacing)
  chart.setCardYSpacing(chartConfig.cardYSpacing)
  chart.setShowSiblingsOfMain(chartConfig.showSiblingsOfMain)
  if (chart && typeof chart.setLinkStyle === 'function') {
    chart.setLinkStyle(chartConfig.linkStyle || 'legacy')
  } else {
    console.warn('builder: chart.setLinkStyle is not available; skipping link style configuration')
  }

  if (chartConfig.orientation === 'horizontal') {
    chart.setOrientationHorizontal()
  } else {
    chart.setOrientationVertical()
  }

  chart.setSingleParentEmptyCard(chartConfig.singleParentEmptyCard, {
    label: chartConfig.singleParentEmptyCardLabel
  })

  if (typeof chartConfig.ancestryDepth === 'number' && Number.isFinite(chartConfig.ancestryDepth)) {
    chart.setAncestryDepth(chartConfig.ancestryDepth)
  } else {
    chart.setAncestryDepth(null)
  }

  if (typeof chartConfig.progenyDepth === 'number' && Number.isFinite(chartConfig.progenyDepth)) {
    chart.setProgenyDepth(chartConfig.progenyDepth)
  } else {
    chart.setProgenyDepth(null)
  }


}

async function loadTree(params = {}) {
  setStatus('Chargement des données…')
  setChartLoading(true, 'Chargement des données…')

  const url = new URL('/api/tree', window.location.origin)
  if (params.ancestryDepth !== undefined && params.ancestryDepth !== null) url.searchParams.set('ancestryDepth', params.ancestryDepth)
  if (params.progenyDepth !== undefined && params.progenyDepth !== null) url.searchParams.set('progenyDepth', params.progenyDepth)
  if (params.mainId) url.searchParams.set('mainId', params.mainId)

  const response = await fetch(url.toString(), { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Échec du chargement (${response.status})`)
  }
  return response.json()
}

function destroyTimer() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
}

async function persistChanges(snapshot, { immediate = false } = {}) {
  if (!snapshot) return
  destroyTimer()

  const payload = structuredCloneSafe(snapshot)

  if (isSaving) {
    queuedSave = { snapshot: payload, immediate }
    setStatus('Sauvegarde déjà en cours…', 'saving')
    return
  }

  try {
    isSaving = true
    setStatus(immediate ? 'Enregistrement en cours…' : 'Sauvegarde automatique…', 'saving')

    const response = await fetch('/api/tree', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload, null, 2)
    })

    if (!response.ok && response.status !== 204) {
      throw new Error(`Serveur a retourné ${response.status}`)
    }

    lastSnapshotString = JSON.stringify(payload)
    setStatus('Modifications enregistrées ✅', 'success')
  } catch (error) {
    console.error(error)
    setStatus(`Erreur d'enregistrement: ${error.message}`, 'error')
  } finally {
    isSaving = false
    if (queuedSave) {
      const next = queuedSave
      queuedSave = null
      await persistChanges(next.snapshot, { immediate: next.immediate })
    }
  }
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

function getSnapshot() {
  if (!editTreeInstance) return null
  const data = editTreeInstance.exportData()
  if (!data) return null
  return {
    data,
    config: structuredCloneSafe(chartConfig)
  }
}

function scheduleAutoSave() {
  destroyTimer()
  setStatus('Modification détectée… sauvegarde automatique imminente', 'saving')
  autoSaveTimer = setTimeout(() => {
    const snapshot = getSnapshot()
    if (!snapshot) return
    persistChanges(snapshot)
  }, 1500)
}

function setupChart(payload) {
  const container = document.querySelector(chartSelector)
  if (!container) {
    throw new Error('Conteneur du graphique introuvable')
  }

  setChartLoading(true, 'Construction du graphique…')
  clearElement(container)
  builderSearchReady = false
  builderSearchOptions = []
  setBuilderSearchState('loading')
  setMainProfileHandler = null
  transientMainSelection = false
  renderBreadcrumbTrail(null)
  builderSearchInput = null
  setSearchPanelFocusState(false)
  if (cardHighlightTimer) {
    clearTimeout(cardHighlightTimer)
    cardHighlightTimer = null
  }
  activeHighlightedCard = null
  pendingHighlightId = null

  if (typeof activePanelTeardown === 'function') {
    activePanelTeardown()
    activePanelTeardown = null
  }

  const { data, config } = normaliseTreePayload(payload)
  try {
    if (Array.isArray(data) && data.length) {
      const imageKeys = ['avatar', 'photo', 'picture']
      data.forEach(datum => {
        if (!datum || !datum.data) return
        imageKeys.forEach(key => {
          try {
            const value = datum.data[key]
            if (!value) return
            const storeValue = stripOriginIfSame(value)
            datum.data[key] = storeValue
          } catch (e) {
          }
        })
      })
    }
  } catch (error) {
  }
  chartConfig = buildChartConfig(normaliseChartConfig(config))
  currentEditableFields = [...chartConfig.editableFields]
  if (!currentEditableFields.length) {
    currentEditableFields = [...DEFAULT_EDITABLE_FIELDS]
  }

  const initialEditableFields = [...currentEditableFields]
  const initialFieldDescriptors = buildFieldDescriptors(initialEditableFields)
  try {
    console.debug('builder: initialFieldDescriptors', initialFieldDescriptors)
  } catch (e) {
  }

  const chart = f3.createChart(chartSelector, data)
  activeChartInstance = chart
  applyChartConfigToChart(chart)

  const initialCardDisplay = chartConfig.cardDisplay && chartConfig.cardDisplay.length
    ? chartConfig.cardDisplay.map(row => [...row])
    : cloneCardDisplay(DEFAULT_CARD_DISPLAY)

  const card = chart.setCardHtml()
    .setCardDisplay(initialCardDisplay)
    .setCardImageField('avatar')
    .setMiniTree(chartConfig.miniTree !== false)
    .setOnCardUpdate(function onCardUpdate(treeDatum) {
      const cardNode = this.querySelector('.card')
      if (!cardNode) return
      const personId = treeDatum && treeDatum.data ? treeDatum.data.id : null
      if (personId) {
        cardNode.dataset.personId = personId
      } else {
        delete cardNode.dataset.personId
      }
      const mainId = chart.store && typeof chart.store.getMainId === 'function' ? chart.store.getMainId() : null
      cardNode.classList.toggle('card-main-active', Boolean(mainId && personId === mainId))
      if (personId && pendingHighlightId === personId) {
        applyCardHighlight(cardNode, { animate: false })
      }
    })





  try {
    if (typeof card.setOnCardClick === 'function') {
      card.setOnCardClick((event, treeDatum) => {
        try {
          const id = treeDatum && treeDatum.data && treeDatum.data.id
          if (!id) return
          const label = buildPersonLabel(treeDatum)
          activateProfileInteraction(id, {
            openEditor: true,
            highlightCard: true,
            focusSearch: true,
            searchLabel: label
          })
        } catch (e) {
          console.error('builder: erreur lors du clic sur la carte', e)
        }
      })
    }

    if (typeof card.setOnMiniTreeClick === 'function') {
      card.setOnMiniTreeClick((event, treeDatum) => {
        try {
          const id = treeDatum && treeDatum.data && treeDatum.data.id
          if (!id) return
          const label = buildPersonLabel(treeDatum)
          activateProfileInteraction(id, {
            openEditor: true,
            highlightCard: true,
            focusSearch: true,
            searchLabel: label
          })
        } catch (e) {
          console.error('builder: erreur lors du clic sur le mini-arbre', e)
        }
      })
    }
  } catch (e) {
    console.warn('builder: impossible d’attacher les gestionnaires de clic sur les cartes', e)
  }

  let panelControlAPI = null
  let searchControlAPI = null
  const dataArray = Array.isArray(data) ? data : []

  editTreeInstance = chart.editTree()
    .setFields(initialFieldDescriptors)
    .setEditFirst(true)
    .setCardClickOpen(card)
    .setOnChange(() => {
      lastSnapshotString = null
      if (panelControlAPI) {
        panelControlAPI.refreshMainProfileOptions({ keepSelection: true })
        panelControlAPI.syncMainProfileSelection({ scheduleSaveIfChanged: false })
      }
      if (searchControlAPI) {
        searchControlAPI.refreshSearchOptions()
      }
      scheduleAutoSave()
    })

  panelControlAPI = attachPanelControls({ chart, card }) || {
    refreshMainProfileOptions: () => { },
    syncMainProfileSelection: () => { },
    handleFormCreation: () => { },
    teardown: () => { }
  }

  if (editTreeInstance && panelControlAPI.handleFormCreation) {
    if (typeof editTreeInstance.setOnFormCreation === 'function') {
      const originalHandler = panelControlAPI.handleFormCreation
      editTreeInstance.setOnFormCreation((args) => {
        originalHandler(args)
        // Hook for File Management
        if (args && args.form_creator && args.form_creator.datum_id) {
          window.builderCurrentPersonId = args.form_creator.datum_id
          if (typeof loadBuilderFiles === 'function' && document.querySelector('[data-tab="files"].active')) {
            loadBuilderFiles(args.form_creator.datum_id)
          }
        }
      })
    }
  }

  searchControlAPI = initBuilderSearch(chart)

  if (typeof panelControlAPI.teardown === 'function') {
    activePanelTeardown = panelControlAPI.teardown
  } else {
    activePanelTeardown = null
  }

  chart.setAfterUpdate(() => {
    if (!chart.store || typeof chart.store.getMainId !== 'function') return
    const storeMainId = chart.store.getMainId()
    if (!storeMainId && chartConfig.mainId) {
      chartConfig = { ...chartConfig, mainId: null }
      lastSnapshotString = null
      if (!isApplyingConfig) {
        scheduleAutoSave()
      }
    }
    if (panelControlAPI) {
      panelControlAPI.syncMainProfileSelection({ scheduleSaveIfChanged: false })
    }
    if (!builderSearchReady && searchControlAPI) {
      searchControlAPI.refreshSearchOptions()
    }
    renderBreadcrumbTrail(storeMainId || chartConfig.mainId || null)
  })

  if (panelControlAPI) {
    panelControlAPI.refreshMainProfileOptions({ keepSelection: false })
    panelControlAPI.syncMainProfileSelection({ scheduleSaveIfChanged: false })
  }

  chart.updateTree({ initial: true, tree_position: 'fit' })

  let mainDatum = null
  try {
    mainDatum = chart.getMainDatum()
    if (mainDatum) {
      editTreeInstance.open(mainDatum)
    }
  } catch (e) {
    console.debug('[Builder] No main datum found (empty tree?)', e)
  }
  renderBreadcrumbTrail(chart.store?.getMainId?.() || chartConfig.mainId || null)

  const initialSnapshot = getSnapshot()
  lastSnapshotString = initialSnapshot ? JSON.stringify(initialSnapshot) : null
  const totalPersons = dataArray.length
  setStatus(
    totalPersons > 0
      ? `Éditeur prêt ✅ – ${totalPersons} personne(s) chargée(s)`
      : 'Fichier de données vide',
    totalPersons > 0 ? 'success' : 'error'
  )
  setChartLoading(false)

  if (totalPersons === 0) {
    const container = document.getElementById('FamilyChart')
    if (container) {
      container.innerHTML = `
        <div class="empty-state-container">
          <button class="create-tree-btn" id="createTreeBtn">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Créer un nouvel arbre
          </button>
        </div>
      `
      document.getElementById('createTreeBtn')?.addEventListener('click', () => {
        const newPerson = {
          id: 'root',
          data: {
            'first name': 'Nouvelle',
            'last name': 'Personne',
            'gender': 'M'
          },
          rels: {}
        }
        chart.store.updateData([newPerson])
        chart.updateTree({ initial: true })
        try {
          editTreeInstance.open(chart.getMainDatum())
        } catch (e) {
          console.warn('[Builder] Could not open new root person', e)
        }
        setStatus('Nouvel arbre créé', 'success')
      })
    }
  }

  function resolveInitialMainId(persons, chartInstance) {
    if (!Array.isArray(persons) || persons.length === 0) {
      chartConfig = { ...chartConfig, mainId: null }
      return null
    }

    const availableIds = new Set(persons.map(person => person && person.id).filter(Boolean))
    const desiredId = typeof chartConfig.mainId === 'string' ? chartConfig.mainId.trim() : ''
    if (desiredId && availableIds.has(desiredId)) {
      return desiredId
    }

    const storeMainId = chartInstance?.store && typeof chartInstance.store.getMainId === 'function'
      ? chartInstance.store.getMainId()
      : null

    if (storeMainId && availableIds.has(storeMainId)) {
      if (chartConfig.mainId !== storeMainId) {
        chartConfig = { ...chartConfig, mainId: storeMainId }
      }
      return storeMainId
    }

    const fallbackId = persons[0]?.id || null
    if (fallbackId && chartConfig.mainId !== fallbackId) {
      chartConfig = { ...chartConfig, mainId: fallbackId }
    }
    return fallbackId
  }
}

function attachPanelControls({ chart, card }) {
  if (!panel) {
    return {
      refreshMainProfileOptions: () => { },
      syncMainProfileSelection: () => { },
      handleFormCreation: () => { },
      teardown: () => { }
    }
  }

  const editableFieldset = panel.querySelector('[data-role="editable-fields"]')
  const editableList = editableFieldset?.querySelector('.editable-list')
  const addEditableBtn = editableFieldset?.querySelector('[data-action="add-editable"]')
  const displayGroups = [...panel.querySelectorAll('[data-display-row]')]
  const displayGroupMap = new Map(displayGroups.map(group => [group.dataset.displayRow, group]))
  const fieldLabelStore = createBaseFieldLabelStore()

  const displayDefaultsByRow = new Map(
    Object.entries(DISPLAY_DEFAULTS).map(([row, defs]) => [
      row,
      new Map(defs.map(def => [normalizeFieldKey(def.value), def.checked]))
    ])
  )

  const imageField = panel.querySelector('#imageField')
  const cardStyle = panel.querySelector('#cardStyle')
  const transitionInput = panel.querySelector('#transitionInput')
  const cardYSpacing = panel.querySelector('#cardYSpacing')
  const cardXSpacing = panel.querySelector('#cardXSpacing')
  const emptyLabel = panel.querySelector('#emptyLabel')
  const ancestryDepthSelect = panel.querySelector('#ancestryDepth')
  const progenyDepthSelect = panel.querySelector('#progenyDepth')
  const miniTreeToggle = panel.querySelector('#miniTreeToggle')
  const orientationButtons = panel.querySelectorAll('[data-orientation]')
  const cardWidth = panel.querySelector('#cardWidth')
  const cardHeight = panel.querySelector('#cardHeight')
  const imgWidth = panel.querySelector('#imgWidth')
  const imgHeight = panel.querySelector('#imgHeight')
  const imgX = panel.querySelector('#imgX')
  const imgY = panel.querySelector('#imgY')
  const resetDimensions = panel.querySelector('#resetDimensions')
  const mainProfileFieldset = panel.querySelector('[data-role="main-profile"]')
  const mainProfileSelect = mainProfileFieldset?.querySelector('#mainProfileSelect')
  const mainProfileName = mainProfileFieldset?.querySelector('[data-role="main-profile-name"]')
  if (mainProfileSelect) mainProfileSelect.disabled = true
  const IMAGE_UPLOADER_TEMPLATE = `
  <fieldset class="media-tools" data-role="image-uploader">
    <legend>Images</legend>
    <p class="group-hint">Importez une image depuis votre ordinateur. Taille max&nbsp;: 5&nbsp;Mo.</p>
    <label for="assetUpload" class="file-label">Téléverser une image</label>
    <input type="file" id="assetUpload" accept="image/*">
    <p class="hint" data-role="upload-feedback" data-status="info">Formats recommandés&nbsp;: JPG, PNG, WebP.</p>
    <div class="upload-result hidden" data-role="upload-result" data-url="">
      <span class="upload-label">Image disponible à&nbsp;:</span>
      <code class="upload-url" data-role="upload-url"></code>
      <div class="upload-actions">
        <button type="button" class="ghost small" data-action="copy-upload-url">Copier l’URL</button>
        <a class="ghost small hidden" data-role="open-upload" href="#" target="_blank" rel="noopener">Ouvrir</a>
        <button type="button" class="ghost small" data-action="delete-upload">Supprimer la photo</button>
      </div>
    </div>
  </fieldset>
  `

  // Create uploader from template
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = IMAGE_UPLOADER_TEMPLATE
  const imageUploader = tempDiv.firstElementChild

  // Remove existing if present (cleanup)
  const existingUploader = panel.querySelector('[data-role="image-uploader"]')
  if (existingUploader) existingUploader.remove()

  const assetUploadInput = imageUploader?.querySelector('#assetUpload')
  const assetUploadFeedback = imageUploader?.querySelector('[data-role="upload-feedback"]')
  const assetUploadResult = imageUploader?.querySelector('[data-role="upload-result"]')
  const assetUploadUrlOutput = imageUploader?.querySelector('[data-role="upload-url"]')
  const assetUploadOpenLink = imageUploader?.querySelector('[data-role="open-upload"]')
  const copyUploadUrlBtn = imageUploader?.querySelector('[data-action="copy-upload-url"]')
  const deleteUploadBtn = imageUploader?.querySelector('[data-action="delete-upload"]')
  // manual URL input removed from UI — hide file input filename and use the label as trigger
  const fileLabel = imageUploader?.querySelector('.file-label')

  // Inject into Edit Form
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        const labels = document.querySelectorAll('label')
        let bioLabel = null
        for (const l of labels) {
          if (l.closest('#controlPanel')) continue
          if (l.textContent && l.textContent.includes('Biographie')) {
            bioLabel = l
            break
          }
        }

        if (bioLabel) {
          // Found Bio label, find its container (usually a div wrapping label and input)
          // We want to insert AFTER this container
          const container = bioLabel.closest('div')
          if (container && container.parentElement) {
            if (!container.parentElement.contains(imageUploader)) {
              container.parentElement.insertBefore(imageUploader, container.nextSibling)
            }
          }
        }
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  const imageUploaderHome = null // No longer needed as we inject dynamically

  let imageUploaderCurrentForm = null
  let imageUploaderCurrentDatumId = null

  function getActiveImageFieldId() {
    const value = imageField?.value?.trim()
    return value || 'avatar'
  }

  function getActiveDatum() {
    if (!imageUploaderCurrentDatumId || !editTreeInstance?.store?.getDatum) return null
    try {
      return editTreeInstance.store.getDatum(imageUploaderCurrentDatumId) || null
    } catch (error) {
      console.error('Impossible de rÃ©cupÃ©rer le profil actif pour le tÃ©lÃ©versement', error)
      return null
    }
  }

  function normaliseUrl(rawUrl) {
    if (!rawUrl) return ''
    try {
      return new URL(rawUrl, window.location.origin).toString()
    } catch (error) {
      return String(rawUrl)
    }
  }

  function stripOriginIfSame(rawUrl) {
    if (!rawUrl) return ''
    try {
      const parsed = new URL(rawUrl, window.location.origin)
      if (parsed.origin === window.location.origin) {
        return `${parsed.pathname}${parsed.search}${parsed.hash} `
      }
      return parsed.toString()
    } catch (error) {
      return String(rawUrl)
    }
  }

  function isSafeAbsoluteUrl(rawUrl) {
    if (!rawUrl) return false
    try {
      const u = new URL(rawUrl, window.location.origin)
      const proto = (u.protocol || '').toLowerCase()
      if (proto === 'http:' || proto === 'https:') return true
      if (proto === 'data:') return String(rawUrl).startsWith('data:image/')
      return false
    } catch (e) {
      return false
    }
  }

  function isSafeImageUrl(rawUrl) {
    if (!rawUrl) return false
    try {
      const u = new URL(rawUrl, window.location.origin)
      const proto = (u.protocol || '').toLowerCase()
      if (proto === 'http:' || proto === 'https:') {
        return /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(u.pathname)
      }
      if (proto === 'data:') return String(rawUrl).startsWith('data:image/')
      return false
    } catch (e) {
      return false
    }
  }

  function applyImageToActiveProfile(rawUrl, { origin = 'manual', sizeBytes } = {}) {
    const absoluteUrl = normaliseUrl(rawUrl)
    if (!absoluteUrl) return

    if (!isSafeImageUrl(absoluteUrl)) {
      setUploadFeedback('URL d’image non sûre ou format non supporté.', 'error')
      setStatus('URL d’image non sûre', 'error')
      return
    }

    const targetFieldId = getActiveImageFieldId()
    const escapedFieldId = targetFieldId.replace(/"/g, '\\"')
    let formUpdated = false
    let datumUpdated = false

    if (imageUploaderCurrentForm) {
      const targetInput = imageUploaderCurrentForm.querySelector(`[name = "${escapedFieldId}"]`)
      if (targetInput && targetInput instanceof HTMLInputElement) {
        const storeValue = stripOriginIfSame(absoluteUrl)
        if (targetInput.value !== storeValue) {
          targetInput.value = storeValue
          targetInput.dispatchEvent(new Event('input', { bubbles: true }))
        }
        formUpdated = true
      } else if (targetInput && targetInput instanceof HTMLTextAreaElement) {
        const storeValue = stripOriginIfSame(absoluteUrl)
        if (targetInput.value !== storeValue) {
          targetInput.value = storeValue
          targetInput.dispatchEvent(new Event('input', { bubbles: true }))
        }
        formUpdated = true
      }
    }

    const activeDatum = getActiveDatum()
    if (activeDatum) {
      if (!activeDatum.data) activeDatum.data = {}
      const storeValue = stripOriginIfSame(absoluteUrl)
      if (activeDatum.data[targetFieldId] !== storeValue) {
        activeDatum.data[targetFieldId] = storeValue
        datumUpdated = true
      }
    }

    if (datumUpdated) {
      try {
        chart.updateTree({ initial: false, tree_position: 'inherit' })
      } catch (error) {
        console.error('Impossible de rafraîchir le graphique après mise à jour de l’image', error)
      }
      scheduleAutoSave()
    }

    // manual URL input removed — nothing to set here

    const appliedSomewhere = formUpdated || datumUpdated
    if (origin === 'upload') {
      if (appliedSomewhere) {
        const sizeMessage = sizeBytes ? ` (${formatBytes(sizeBytes)})` : ''
        setUploadFeedback(`Image téléversée${sizeMessage} et appliquée au profil.`, 'success')
        setStatus('Image appliquée au profil ✅', 'success')
      } else {
        const sizeMessage = sizeBytes ? ` (${formatBytes(sizeBytes)})` : ''
        setUploadFeedback(`Image téléversée${sizeMessage}. Sélectionnez un profil éditable pour l’appliquer.`, 'info')
      }
    } else if (appliedSomewhere) {
      setUploadFeedback('Image appliquée au profil.', 'success')
      setStatus('Image appliquÃ©e au profil âœ…', 'success')
    } else {
      setUploadFeedback('SÃ©lectionnez un profil Ã©ditable pour appliquer lâ€™image.', 'info')
    }
  }

  function populateUploaderFromDatum() {
    const targetFieldId = getActiveImageFieldId()
    const activeDatum = getActiveDatum()
    const existingValue = activeDatum?.data?.[targetFieldId] || ''



    if (!existingValue) {
      clearUploadResult()
      setUploadFeedback('Formats recommandés : JPG, PNG, WebP.', 'info')
      return
    }

    const absoluteUrl = showUploadResult(existingValue, { silent: true })
    // manual URL input removed â€” nothing to update
    setUploadFeedback('Image actuelle du profil chargÃ©e.', 'info')
  }

  function restoreImageUploaderToPanel() {
    if (!imageUploader || !imageUploaderHome?.parent) return
    if (imageUploaderCurrentForm) {
      imageUploaderCurrentForm = null
    }
    imageUploaderCurrentDatumId = null
    const { parent, nextSibling } = imageUploaderHome
    if (nextSibling && parent.contains(nextSibling)) {
      parent.insertBefore(imageUploader, nextSibling)
    } else {
      parent.appendChild(imageUploader)
    }
    imageUploader.classList.remove('is-modal-context')
    clearUploadResult()
    setUploadFeedback('Importez une image depuis votre ordinateur. Formats recommandés : JPG, PNG, WebP.', 'info')
  }

  function injectImageUploaderIntoForm(form) {
    if (!imageUploader || !form) return
    if (imageUploaderCurrentForm === form) return

    restoreImageUploaderToPanel()

    const unionSection = form.querySelector('.f3-union-section')
    const buttons = form.querySelector('.f3-form-buttons')

    if (unionSection && unionSection.parentNode) {
      unionSection.parentNode.insertBefore(imageUploader, unionSection)
    } else if (buttons && buttons.parentNode) {
      buttons.parentNode.insertBefore(imageUploader, buttons)
    } else {
      form.appendChild(imageUploader)
    }
    imageUploader.classList.add('is-modal-context')
    imageUploaderCurrentForm = form
  }

  function handleFormCreation({ cont, form_creator }) {
    if (!imageUploader) return
    const form = cont?.querySelector?.('form')
    if (!form) {
      restoreImageUploaderToPanel()
      return
    }

    try {

      console.debug('builder: handleFormCreation form_creator.editable=', form_creator?.editable, 'datum_id=', form_creator?.datum_id)
      console.debug('builder: form_creator.fields', form_creator?.fields)
    } catch (e) {
    }

    const isEditable = form_creator?.editable !== false && !form_creator?.no_edit
    if (!isEditable) {
      if (form.contains(imageUploader)) {
        restoreImageUploaderToPanel()
      }
      return
    }

    injectImageUploaderIntoForm(form)
    imageUploaderCurrentDatumId = form_creator?.datum_id || null
    populateUploaderFromDatum()


    try {
      const datePlaceholder = 'ex : 30.12.2000'
      const inputs = [...form.querySelectorAll('input[name], textarea[name]')]
      inputs.forEach(el => {
        const name = (el.getAttribute('name') || '').toLowerCase()

        let labelText = ''
        try {
          const id = el.getAttribute('id')
          if (id) {
            const lbl = form.querySelector(`label[for= "${escapeSelector(id)}"]`)
            if (lbl && lbl.textContent) labelText = lbl.textContent.trim().toLowerCase()
          }
        } catch (e) {
          /* ignore */
        }

        const combined = `${name} ${labelText} `

        if (/\b(birth|birthday|death|union|marri|wedding|anniv|date)\b/.test(combined)) {
          if (!el.getAttribute('placeholder') || el.getAttribute('placeholder').trim() === '') {
            el.setAttribute('placeholder', datePlaceholder)
          }
        }
      })
    } catch (e) {
    }
  }

  function teardownImageUploader() {
    restoreImageUploaderToPanel()
  }

  if (imageUploader && imageUploaderHome?.parent && imageUploader.parentElement !== imageUploaderHome.parent) {
    restoreImageUploaderToPanel()
  }

  const MAX_UPLOAD_SIZE = 5 * 1024 * 1024

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return ''
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`
  }

  function setUploadFeedback(message, status = 'info') {
    if (!assetUploadFeedback) return
    assetUploadFeedback.textContent = message
    assetUploadFeedback.dataset.status = status
  }

  function clearUploadResult() {
    if (!assetUploadResult) return
    assetUploadResult.classList.add('hidden')
    assetUploadResult.dataset.url = ''
    if (assetUploadUrlOutput) assetUploadUrlOutput.textContent = ''
    if (assetUploadOpenLink) {
      assetUploadOpenLink.href = '#'
      assetUploadOpenLink.classList.add('hidden')
    }
  }

  function showUploadResult(url, { silent = false } = {}) {
    if (!assetUploadResult) return ''
    const absoluteUrl = normaliseUrl(url)

    assetUploadResult.dataset.url = absoluteUrl
    if (assetUploadUrlOutput) assetUploadUrlOutput.textContent = absoluteUrl
    if (assetUploadOpenLink) {
      if (isSafeAbsoluteUrl(absoluteUrl)) {
        assetUploadOpenLink.href = absoluteUrl
        assetUploadOpenLink.classList.remove('hidden')
      } else {
        assetUploadOpenLink.href = '#'
        assetUploadOpenLink.classList.add('hidden')
      }
    }
    assetUploadResult.classList.remove('hidden')
    // manual URL input removed â€” nothing to update
    if (!silent) setUploadFeedback('Image prÃªte Ã  Ãªtre appliquÃ©e.', 'info')

    return absoluteUrl
  }

  async function copyToClipboard(value, { successMessage = 'CopiÃ© dans le presse-papiers âœ…', errorMessage = 'Impossible de copier.' } = {}) {
    if (!value) {
      setUploadFeedback('Aucune URL Ã  copier.', 'error')
      return
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const temp = document.createElement('textarea')
        temp.value = value
        temp.setAttribute('readonly', '')
        temp.style.position = 'absolute'
        temp.style.left = '-9999px'
        document.body.append(temp)
        temp.select()
        document.execCommand('copy')
        temp.remove()
      }
      setStatus(successMessage, 'success')
      setUploadFeedback(successMessage, 'success')
    } catch (error) {
      console.error(error)
      setStatus(errorMessage, 'error')
      setUploadFeedback(errorMessage, 'error')
    }
  }

  async function handleFileUpload(file) {
    if (!file) return
    clearUploadResult()

    if (!file.type || !file.type.startsWith('image/')) {
      setUploadFeedback('Format non pris en charge. SÃ©lectionnez une image (JPEG, PNG, WebPâ€¦).', 'error')
      return
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      setUploadFeedback(`Fichier trop volumineux(${formatBytes(file.size)
        }). Limite 5 Mo.`, 'error')
      return
    }

    setUploadFeedback('TÃ©lÃ©versement en coursâ€¦', 'saving')
    setStatus('TÃ©lÃ©versement de lâ€™imageâ€¦', 'saving')

    const formData = new FormData()
    formData.append('file', file, file.name)
    if (imageUploaderCurrentDatumId) {
      formData.append('personId', imageUploaderCurrentDatumId)
    }
    // No need to send field anymore â€” server will store the upload as /document/<personId>/profil.<ext>

    try {
      const response = await fetch('/api/document', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        let message = `Erreur serveur(${response.status})`
        try {
          const payload = await response.json()
          if (payload?.message) message = payload.message
        } catch (error) {

        }
        throw new Error(message)
      }

      const payload = await response.json()
      const uploadedUrl = payload?.url
      if (!uploadedUrl) {
        throw new Error('RÃ©ponse du serveur invalide (URL manquante).')
      }

      const absoluteUrl = showUploadResult(uploadedUrl)
      applyImageToActiveProfile(absoluteUrl, { origin: 'upload', sizeBytes: file.size })
    } catch (error) {
      console.error(error)
      setUploadFeedback(error.message || 'Ã‰chec du tÃ©lÃ©versement.', 'error')
      setStatus(`TÃ©lÃ©versement Ã©chouÃ©: ${error.message || 'Erreur inconnue'} `, 'error')
      clearUploadResult()
    }
  }

  clearUploadResult()
  if (assetUploadFeedback) {
    setUploadFeedback(assetUploadFeedback.textContent || 'Formats recommandÃ©s : JPG, PNG, WebP.', 'info')
  }

  function setOrientationButtonsState(orientation) {
    orientationButtons.forEach(button => {
      const isActive = button.dataset.orientation === orientation
      button.classList.toggle('active', isActive)
    })
  }

  function refreshConfigControls() {
    if (transitionInput) transitionInput.value = chartConfig.transitionTime?.toString() ?? ''
    if (cardXSpacing) cardXSpacing.value = chartConfig.cardXSpacing?.toString() ?? ''
    if (cardYSpacing) cardYSpacing.value = chartConfig.cardYSpacing?.toString() ?? ''
    if (emptyLabel) {
      const label = chartConfig.singleParentEmptyCardLabel ?? DEFAULT_CHART_CONFIG.singleParentEmptyCardLabel
      emptyLabel.value = label
    }
    if (ancestryDepthSelect) {
      const saved = localStorage.getItem('family-tree-ancestry-depth')
      const val = saved ? Number(saved) : (chartConfig.ancestryDepth ?? DEFAULT_CHART_CONFIG.ancestryDepth)
      ancestryDepthSelect.value = depthToSelectValue(val, DEFAULT_CHART_CONFIG.ancestryDepth)
    }
    if (progenyDepthSelect) {
      const saved = localStorage.getItem('family-tree-progeny-depth')
      const val = saved ? Number(saved) : (chartConfig.progenyDepth ?? DEFAULT_CHART_CONFIG.progenyDepth)
      progenyDepthSelect.value = depthToSelectValue(val, DEFAULT_CHART_CONFIG.progenyDepth)
    }
    if (miniTreeToggle) miniTreeToggle.checked = chartConfig.miniTree !== false

    setOrientationButtonsState(chartConfig.orientation || DEFAULT_CHART_CONFIG.orientation)
  }

  function commitConfigUpdate(partialConfig = {}, { treePosition = 'inherit', refresh = true } = {}) {
    chartConfig = { ...chartConfig, ...partialConfig }
    applyChartConfigToChart(chart)
    if (card && typeof card.setMiniTree === 'function') {
      card.setMiniTree(chartConfig.miniTree !== false)
    }
    if (refresh) {
      const prevState = isApplyingConfig
      isApplyingConfig = true
      refreshConfigControls()
      isApplyingConfig = prevState
    }
    chart.updateTree({ initial: false, tree_position: treePosition })
    lastSnapshotString = null
    if (!isApplyingConfig) {
      scheduleAutoSave()
    }
  }

  function parseNumberInput(input, fallback) {
    if (!input) return fallback
    const value = Number(input.value)
    return Number.isFinite(value) ? value : fallback
  }

  function depthToSelectValue(value, fallback) {
    if (value === null) return ''
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return String(Math.floor(value))
    }
    if (typeof fallback === 'number' && Number.isFinite(fallback) && fallback >= 0) {
      return String(Math.floor(fallback))
    }
    return ''
  }

  function parseDepthSelectValue(select, fallback) {
    if (!select) return fallback
    if (select.value === '') return null
    const value = Number(select.value)
    if (Number.isFinite(value) && value >= 0) {
      return Math.floor(value)
    }
    return fallback
  }

  function ensureFieldLabel(value, label) {
    const key = normalizeFieldKey(value)
    if (label) {
      fieldLabelStore.set(key, label.trim() || value)
    } else if (!fieldLabelStore.has(key)) {
      fieldLabelStore.set(key, value)
    }
    return fieldLabelStore.get(key) || value
  }

  function createFieldDescriptors(fieldValues) {
    const descriptors = sanitizeFieldValues(fieldValues)
      .map(value => ({ value, key: normalizeFieldKey(value) }))
      .filter(item => !HIDDEN_FIELD_KEYS.has(item.key))
      .map(item => {
        const label = ensureFieldLabel(item.value, fieldLabelStore.get(item.key))
        return createFieldDescriptor(item.key, item.value, label)
      })
    return appendUnionFieldDescriptors(descriptors, fieldLabelStore)
  }

  function updateMainProfileDisplay(id) {
    if (!mainProfileName) return
    if (!id) {
      mainProfileName.textContent = 'â€”'
      return
    }
    const datum = editTreeInstance?.store?.getDatum?.(id)
    if (!datum) {
      mainProfileName.textContent = 'â€”'
      return
    }
    mainProfileName.textContent = buildPersonLabel(datum)
  }

  function refreshMainProfileOptions() {
    // No-op: Select replaced by Text Input
    if (mainProfileSelect) mainProfileSelect.disabled = false
    updateMainProfileDisplay(mainProfileSelect ? mainProfileSelect.value : null)
  }

  function syncMainProfileSelection({ scheduleSaveIfChanged = false } = {}) {
    if (!chart.store || typeof chart.store.getMainId !== 'function') {
      return
    }

    const storeMainId = chart.store.getMainId()
    const persons = getAllPersons()
    const availableIds = new Set(persons.map(d => d && d.id).filter(Boolean))
    const currentConfigMain = typeof chartConfig.mainId === 'string' && chartConfig.mainId.trim() ? chartConfig.mainId.trim() : null

    let nextConfigMain = currentConfigMain

    if (nextConfigMain && !availableIds.has(nextConfigMain)) {
      nextConfigMain = null
    }

    const configMissing = !nextConfigMain
    const shouldAdoptStoreMain = configMissing && !ignoreNextMainSync && storeMainId && availableIds.has(storeMainId)

    if (shouldAdoptStoreMain) {
      nextConfigMain = storeMainId
    }

    if (!nextConfigMain && persons.length) {
      const fallbackId = persons[0]?.id || null
      if (fallbackId && availableIds.has(fallbackId)) {
        nextConfigMain = fallbackId
      }
    }

    if (nextConfigMain !== currentConfigMain) {
      chartConfig = { ...chartConfig, mainId: nextConfigMain }
      lastSnapshotString = null
      if (scheduleSaveIfChanged && !isApplyingConfig) {
        scheduleAutoSave()
      }
    }

    if (mainProfileSelect) {
      if (nextConfigMain) {
        mainProfileSelect.value = nextConfigMain
      } else {
        mainProfileSelect.value = ''
      }
      mainProfileSelect.disabled = false // Always enabled
    }

    updateMainProfileDisplay(nextConfigMain || null)
    ignoreNextMainSync = false
  }

  function setMainProfile(id, {
    openEditor = true,
    suppressSave = false,
    focusSearch = false,
    highlightCard = true,
    source = 'manual',
    persistConfig = true
  } = {}) {
    if (!id) return
    if (persistConfig) {
      transientMainSelection = false
    }
    const persons = getAllPersons()
    if (!persons.some(person => person.id === id)) {
      // Allow it anyway, maybe user typed a new ID or invalid one - will fail gracefully later
    }

    const configChanged = persistConfig && chartConfig.mainId !== id
    if (configChanged) {
      chartConfig = { ...chartConfig, mainId: id }
    }

    if (configChanged && !suppressSave) {
      lastSnapshotString = null
      if (!isApplyingConfig) {
        scheduleAutoSave()
      }
    }

    const storeMainBefore = chart.store && typeof chart.store.getMainId === 'function'
      ? chart.store.getMainId()
      : null

    if (!persistConfig && storeMainBefore !== id) {
      ignoreNextMainSync = true
    }

    const shouldUpdateMainId = chart && typeof chart.updateMainId === 'function'
    let recenterAlreadyScheduled = false


    if (persistConfig && shouldUpdateMainId && storeMainBefore !== id) {
      chart.updateMainId(id)
      chart.updateTree({ initial: false, tree_position: 'main_to_middle' })
      recenterAlreadyScheduled = true
    }

    if (persistConfig && mainProfileSelect && mainProfileSelect.value !== id) {
      mainProfileSelect.value = id
      mainProfileSelect.disabled = false
    }

    if (persistConfig) {
      updateMainProfileDisplay(id)
    } else {
      updateMainProfileDisplay(chartConfig.mainId || null)
    }


    try {
      if (!recenterAlreadyScheduled && chart && typeof chart.updateTree === 'function') {
        chart.updateTree({ initial: false, tree_position: 'main_to_middle' })
      }
    } catch (error) {
      console.error('Impossible de recentrer le graphique aprÃ¨s sÃ©lection du profil', error)
    }
    const datum = editTreeInstance?.store?.getDatum?.(id) || null
    if (focusSearch) {
      const label = datum ? buildPersonLabel(datum) : `Profil ${id} `
      focusBuilderSearch({ label, select: true, flash: true, preventScroll: source === 'search' })
    }
    if (highlightCard) {
      highlightCardById(id, { animate: true })
    }
    renderBreadcrumbTrail(id)
    if (openEditor && editTreeInstance && datum) {
      editTreeInstance.open(datum)
    }
  }

  if (mainProfileSelect) {
    mainProfileSelect.addEventListener('change', event => {
      const { value } = event.target
      if (!value) return
      setMainProfile(value)
    })
  }

  function escapeSelector(value) {
    return cssEscape(value)
  }

  function addRemoveButton(item) {
    if (item.querySelector('.remove-field')) return
    const removeBtn = document.createElement('button')
    removeBtn.type = 'button'
    removeBtn.className = 'remove-field'
    removeBtn.textContent = 'Retirer'
    removeBtn.addEventListener('click', () => {
      item.remove()
      updateCardDisplay()
    })
    item.append(removeBtn)
  }

  function removeDisplayFieldEntries(fieldKey) {
    displayGroups.forEach(group => {
      const list = group.querySelector('.field-list')
      if (!list) return
      const selector = `[data-field-key="${escapeSelector(fieldKey)}"]`
      const item = list.querySelector(selector)
      if (!item) return

      if (item.dataset.custom === 'true') {
        item.remove()
      } else {
        const defaults = displayDefaultsByRow.get(group.dataset.displayRow)
        const defaultChecked = defaults?.get(fieldKey)
        const checkbox = item.querySelector('input[type="checkbox"]')
        if (checkbox && typeof defaultChecked === 'boolean') {
          checkbox.checked = defaultChecked
        }
      }
    })
  }

  function getDisplayRowsForField(field) {
    if (!chartConfig.cardDisplay) return []
    const key = normalizeFieldKey(field)
    const rows = []
    chartConfig.cardDisplay.forEach((row, index) => {
      if (row.some(value => normalizeFieldKey(value) === key)) {
        rows.push(String(index + 1))
      }
    })
    return rows
  }

  function ensureConfigEditableItems() {
    if (!Array.isArray(chartConfig.editableFields)) return
    chartConfig.editableFields.forEach(field => {
      const key = normalizeFieldKey(field)
      if (getUnionFieldKind(key)) return
      if (!key) return
      const label = ensureFieldLabel(field, fieldLabelStore.get(key))
      const selector = `[data-field-key="${escapeSelector(key)}"]`
      if (editableList?.querySelector(selector)) return
      createEditableItem({
        value: field,
        label,
        checked: true,
        removable: true,
        selectRows: getDisplayRowsForField(field)
      })
    })
  }

  function applyConfigToEditableControls() {
    if (!editableList) return
    const desired = new Set((chartConfig.editableFields || []).map(normalizeFieldKey))
    editableList.querySelectorAll('input[type="checkbox"]').forEach(input => {
      const key = normalizeFieldKey(input.value)
      input.checked = desired.has(key)
    })
  }

  function applyConfigToDisplayControls() {
    displayGroups.forEach((group, index) => {
      const desiredRow = (chartConfig.cardDisplay && chartConfig.cardDisplay[index]) || []
      const desiredSet = new Set(desiredRow.map(normalizeFieldKey))
      group.querySelectorAll('input[type="checkbox"]').forEach(input => {
        const key = normalizeFieldKey(input.value)
        input.checked = desiredSet.has(key)
      })
    })
  }

  function createDisplayItem(group, { value, label, defaultChecked = false, removable = false }) {
    const list = group.querySelector('.field-list')
    if (!list) return { item: null, isNew: false }
    const key = normalizeFieldKey(value)
    if (HIDDEN_FIELD_KEYS.has(key)) return { item: null, isNew: false }
    const selector = `[data-field-key="${escapeSelector(key)}"]`
    const displayLabel = ensureFieldLabel(value, label)
    let item = list.querySelector(selector)

    if (item) {
      const textEl = item.querySelector('label span')
      if (textEl) textEl.textContent = displayLabel
      if (removable) {
        item.dataset.custom = 'true'
        addRemoveButton(item)
      }
      return { item, isNew: false }
    }

    item = document.createElement('div')
    item.className = 'display-item'
    item.dataset.fieldKey = key
    if (removable) item.dataset.custom = 'true'

    const labelEl = document.createElement('label')
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.value = value
    checkbox.checked = defaultChecked

    const textEl = document.createElement('span')
    textEl.textContent = displayLabel

    labelEl.append(checkbox, textEl)
    item.append(labelEl)

    if (removable) {
      addRemoveButton(item)
    }

    list.append(item)
    return { item, isNew: true }
  }

  function createEditableItem({ value, label, checked = true, removable = false, selectRows = [] }) {
    if (!editableList) return
    const key = normalizeFieldKey(value)
    if (HIDDEN_FIELD_KEYS.has(key)) return
    const displayLabel = ensureFieldLabel(value, label)
    const selector = `[data-field-key="${escapeSelector(key)}"]`
    let item = editableList.querySelector(selector)
    const isNew = !item

    if (!item) {
      item = document.createElement('div')
      item.className = 'editable-item'
      item.dataset.fieldKey = key
      if (removable) item.dataset.custom = 'true'

      const labelEl = document.createElement('label')
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.value = value
      checkbox.checked = checked

      const textEl = document.createElement('span')
      textEl.textContent = displayLabel

      labelEl.append(checkbox, textEl)
      item.append(labelEl)

      if (removable) {
        const removeBtn = document.createElement('button')
        removeBtn.type = 'button'
        removeBtn.className = 'remove-field'
        removeBtn.textContent = 'Retirer'
        removeBtn.addEventListener('click', () => {
          item.remove()
          removeDisplayFieldEntries(key)
          applyEditableFields()
        })
        item.append(removeBtn)
      }

      editableList.append(item)
    } else {
      const checkbox = item.querySelector('input[type="checkbox"]')
      if (checkbox && typeof checked === 'boolean') checkbox.checked = checked
      const textEl = item.querySelector('label span')
      if (textEl) textEl.textContent = displayLabel
      if (removable) item.dataset.custom = 'true'
    }

    const selectRowSet = new Set((selectRows || []).map(String))

    displayGroups.forEach(group => {
      const rowKey = group.dataset.displayRow
      const defaults = displayDefaultsByRow.get(rowKey)
      const defaultChecked = defaults?.get(key)
      const shouldCheck = defaultChecked !== undefined ? defaultChecked : selectRowSet.has(rowKey)
      const removableForGroup = removable
      const { item: displayItem, isNew: created } = createDisplayItem(group, {
        value,
        label: displayLabel,
        defaultChecked: shouldCheck,
        removable: removableForGroup
      })

      if (!displayItem) return
      if (!created && selectRowSet.has(rowKey)) {
        const checkbox = displayItem.querySelector('input[type="checkbox"]')
        if (checkbox) checkbox.checked = true
      }
    })
  }

  function getSelectedValues(group) {
    if (!group) return []
    return [...group.querySelectorAll('input[type="checkbox"]')]
      .filter(input => input.checked)
      .map(input => input.value)
  }

  function areFieldListsEqual(a = [], b = []) {
    if (a.length !== b.length) return false
    return a.every((value, index) => normalizeFieldKey(value) === normalizeFieldKey(b[index]))
  }

  function areCardDisplaysEqual(a = [], b = []) {
    if (a.length !== b.length) return false
    return a.every((row, index) => areFieldListsEqual(row, b[index]))
  }

  function syncDisplayItemsWithEditable(activeKeys) {
    displayGroups.forEach(group => {
      const items = group.querySelectorAll('.display-item')
      items.forEach(item => {
        const key = item.dataset.fieldKey
        const checkbox = item.querySelector('input[type="checkbox"]')
        const isActive = activeKeys.has(key)
        item.classList.toggle('is-disabled', !isActive)
        if (!checkbox) return
        checkbox.disabled = !isActive
        if (!isActive && checkbox.checked) {
          checkbox.checked = false
        }
      })
    })
  }

  function updateCardDisplay({ suppressSave = false } = {}) {
    const row1Group = displayGroupMap.get('1')
    const row2Group = displayGroupMap.get('2')
    const row1 = sanitizeFieldValues(getSelectedValues(row1Group))
    const row2 = sanitizeFieldValues(getSelectedValues(row2Group))
    const fallback = (row1[0])
      || (currentEditableFields.length ? currentEditableFields[0] : (DEFAULT_EDITABLE_FIELDS[0] || 'first name'))
    const appliedRow1 = row1.length ? row1 : [fallback]
    const appliedRows = [appliedRow1, row2]

    card.setCardDisplay(appliedRows)
    chart.updateTree({ initial: false, tree_position: 'inherit' })

    const displayChanged = !areCardDisplaysEqual(chartConfig.cardDisplay, appliedRows)
    if (displayChanged) {
      chartConfig = {
        ...chartConfig,
        cardDisplay: appliedRows.map(row => [...row])
      }
      if (!suppressSave) {
        lastSnapshotString = null
        if (!isApplyingConfig) scheduleAutoSave()
      }
    }
  }

  function applyEditableFields({ suppressSave = false } = {}) {
    if (!editTreeInstance || !editableList) return
    const values = [...editableList.querySelectorAll('input[type="checkbox"]')]
      .filter(input => input.checked)
      .map(input => input.value)
    let applied = values.length ? values : (chartConfig.editableFields.length ? [...chartConfig.editableFields] : ['first name'])
    applied = sanitizeFieldValues(applied)
    if (!applied.length) {
      const fallbackField = DEFAULT_EDITABLE_FIELDS[0] || 'first name'
      applied = [fallbackField]
      if (editableList) {
        const fallbackKey = normalizeFieldKey(fallbackField)
        const selector = `[data - field - key= "${escapeSelector(fallbackKey)}"]input[type = "checkbox"]`
        const fallbackInput = editableList.querySelector(selector)
        if (fallbackInput) fallbackInput.checked = true
      }
    }
    currentEditableFields = [...applied]
    const fieldDescriptors = createFieldDescriptors(applied)
    editTreeInstance.setFields(fieldDescriptors)

    const activeKeys = new Set(applied.map(normalizeFieldKey))
    syncDisplayItemsWithEditable(activeKeys)

    const editableChanged = !areFieldListsEqual(chartConfig.editableFields, applied)
    if (editableChanged) {
      chartConfig = { ...chartConfig, editableFields: [...applied] }
      if (!suppressSave) {
        lastSnapshotString = null
        if (!isApplyingConfig) scheduleAutoSave()
      }
    }

    updateCardDisplay({ suppressSave })

    try {
      if (editTreeInstance && editTreeInstance.store) {
        const datum = editTreeInstance.store.getMainDatum()
        if (datum) editTreeInstance.open(datum)
      }
    } catch (e) {
      // Ignore if main datum is missing (e.g. empty tree)
      console.warn('[Builder] Could not open main datum in editor:', e.message)
    }
  }

  function requestFieldDefinition() {
    const rawValue = prompt('Nom du champ (clé dans vos données) ?')
    if (!rawValue) return null
    const value = rawValue.trim()
    if (!value) return null

    const key = normalizeFieldKey(value)
    const suggestedLabel = fieldLabelStore.get(key) || value
    const labelInput = prompt('Libellé affiché pour ce champ ?', suggestedLabel)
    const displayLabel = (labelInput ?? suggestedLabel).trim() || value

    return { value, label: displayLabel, key }
  }

  function handleAddEditableField({ selectRows = [] } = {}) {
    const definition = requestFieldDefinition()
    if (!definition) return
    const { value, label, key } = definition
    const isDefault = EDITABLE_DEFAULTS.some(def => normalizeFieldKey(def.value) === key)

    createEditableItem({
      value,
      label,
      checked: true,
      removable: !isDefault,
      selectRows
    })

    applyEditableFields()
  }

  EDITABLE_DEFAULTS.forEach(def => {
    if (!HIDDEN_FIELD_KEYS.has(normalizeFieldKey(def.value))) {
      createEditableItem({
        value: def.value,
        label: def.label,
        checked: def.checked !== false,
        removable: false
      })
    }
  })

  editableList?.addEventListener('change', (event) => {
    if (event.target.matches('input[type="checkbox"]')) {
      applyEditableFields()
    }
  })

  addEditableBtn?.addEventListener('click', () => handleAddEditableField())

  displayGroups.forEach(group => {
    group.addEventListener('change', (event) => {
      if (event.target.matches('input[type="checkbox"]')) {
        updateCardDisplay()
      }
    })
  })

  imageField?.addEventListener('change', () => {
    card.setCardImageField(imageField.value)
    chart.updateTree({ initial: false, tree_position: 'inherit' })
    populateUploaderFromDatum()
  })

  cardStyle?.addEventListener('change', () => {
    card.setStyle(cardStyle.value)
    chart.updateTree({ initial: false, tree_position: 'inherit' })
  })

  transitionInput?.addEventListener('change', () => {
    if (isApplyingConfig) return
    const fallback = chartConfig.transitionTime ?? DEFAULT_CHART_CONFIG.transitionTime
    const value = parseNumberInput(transitionInput, fallback)
    const safeValue = Math.max(0, value)
    if (safeValue === chartConfig.transitionTime) return
    commitConfigUpdate({ transitionTime: safeValue })
  })

  cardYSpacing?.addEventListener('change', () => {
    if (isApplyingConfig) return
    const fallback = chartConfig.cardYSpacing ?? DEFAULT_CHART_CONFIG.cardYSpacing
    const value = parseNumberInput(cardYSpacing, fallback)
    const safeValue = value > 0 ? value : fallback
    if (safeValue === chartConfig.cardYSpacing) return
    commitConfigUpdate({ cardYSpacing: safeValue })
  })

  cardXSpacing?.addEventListener('change', () => {
    if (isApplyingConfig) return
    const fallback = chartConfig.cardXSpacing ?? DEFAULT_CHART_CONFIG.cardXSpacing
    const value = parseNumberInput(cardXSpacing, fallback)
    const safeValue = value > 0 ? value : fallback
    if (safeValue === chartConfig.cardXSpacing) return
    commitConfigUpdate({ cardXSpacing: safeValue })
  })

  ancestryDepthSelect?.addEventListener('change', async () => {
    if (isApplyingConfig) return
    const fallback = chartConfig.ancestryDepth ?? DEFAULT_CHART_CONFIG.ancestryDepth ?? null
    const value = parseDepthSelectValue(ancestryDepthSelect, fallback)
    if (value === chartConfig.ancestryDepth) return

    chartConfig.ancestryDepth = value
    localStorage.setItem('family-tree-ancestry-depth', String(value)) // Sync with viewer

    try {
      const payload = await loadTree({
        ancestryDepth: chartConfig.ancestryDepth,
        progenyDepth: chartConfig.progenyDepth,
        mainId: chartConfig.mainId
      })
      if (activeChartInstance && activeChartInstance.store) {
        activeChartInstance.store.updateData(payload.data)
        activeChartInstance.updateTree()
        const snap = getSnapshot()
        if (snap) persistChanges(snap)
      }
    } catch (e) {
      console.error(e)
      alert('Erreur: ' + e.message)
    }
  })

  progenyDepthSelect?.addEventListener('change', async () => {
    if (isApplyingConfig) return
    const fallback = chartConfig.progenyDepth ?? DEFAULT_CHART_CONFIG.progenyDepth ?? null
    const value = parseDepthSelectValue(progenyDepthSelect, fallback)
    if (value === chartConfig.progenyDepth) return

    chartConfig.progenyDepth = value
    localStorage.setItem('family-tree-progeny-depth', String(value)) // Sync with viewer

    try {
      const payload = await loadTree({
        ancestryDepth: chartConfig.ancestryDepth,
        progenyDepth: chartConfig.progenyDepth,
        mainId: chartConfig.mainId
      })
      if (activeChartInstance && activeChartInstance.store) {
        activeChartInstance.store.updateData(payload.data)
        activeChartInstance.updateTree()
        const snap = getSnapshot()
        if (snap) persistChanges(snap)
      }
    } catch (e) {
      console.error(e)
      alert('Erreur: ' + e.message)
    }
  })

  miniTreeToggle?.addEventListener('change', () => {
    if (isApplyingConfig) return
    const enabled = miniTreeToggle.checked
    const previous = chartConfig.miniTree !== false
    if (enabled === previous) return
    commitConfigUpdate({ miniTree: enabled })
  })



  emptyLabel?.addEventListener('change', () => {
    if (isApplyingConfig) return
    const label = (emptyLabel.value || '').trim() || DEFAULT_CHART_CONFIG.singleParentEmptyCardLabel
    if (label === chartConfig.singleParentEmptyCardLabel) return
    commitConfigUpdate({ singleParentEmptyCardLabel: label, singleParentEmptyCard: true })
  })

  orientationButtons?.forEach(button => {
    button.addEventListener('click', () => {
      const orientation = button.dataset.orientation
      const nextOrientation = orientation === 'horizontal' ? 'horizontal' : 'vertical'
      if (chartConfig.orientation === nextOrientation) return
      commitConfigUpdate({ orientation: nextOrientation }, { treePosition: 'fit' })
    })
  })

  function applyCardDimensions() {
    const dims = {}
    add('width', cardWidth)
    add('height', cardHeight)
    add('img_w', imgWidth)
    add('img_h', imgHeight)
    add('img_x', imgX)
    add('img_y', imgY)

    card.resetCardDim()
    if (Object.keys(dims).length > 0) {
      card.setCardDim(dims)
    }
    chart.updateTree({ initial: false, tree_position: 'inherit' })

    function add(key, input) {
      if (!input) return
      const value = Number(input.value)
      if (Number.isFinite(value)) dims[key] = value
    }
  }

  ;[
    cardWidth,
    cardHeight,
    imgWidth,
    imgHeight,
    imgX,
    imgY
  ].forEach(input => input?.addEventListener('change', applyCardDimensions))

  resetDimensions?.addEventListener('click', () => {
    ;[
      [cardWidth, 240],
      [cardHeight, 150],
      [imgWidth, 80],
      [imgHeight, 80],
      [imgX, 16],
      [imgY, 16]
    ].forEach(([input, value]) => {
      if (input) input.value = value
    })
    applyCardDimensions()
  })

  assetUploadInput?.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0]
    if (file) handleFileUpload(file)
    event.target.value = ''
  })

  // Make the visible label open the hidden file input (we hide filename text via CSS)
  fileLabel?.addEventListener('click', (e) => {
    e.preventDefault()
    if (assetUploadInput) assetUploadInput.click()
  })

  copyUploadUrlBtn?.addEventListener('click', () => {
    const storedUrl = assetUploadResult?.dataset?.url || assetUploadUrlOutput?.textContent?.trim()
    if (storedUrl) applyImageToActiveProfile(storedUrl, { origin: 'manual' })
    copyToClipboard(storedUrl, {
      successMessage: 'URL du téléversement copiée ✅',
      errorMessage: 'Impossible de copier l’URL du téléversement.'
    })
  })

  deleteUploadBtn?.addEventListener('click', async () => {
    const datum = getActiveDatum()
    const personId = imageUploaderCurrentDatumId || (datum && datum.id)
    if (!personId) {
      setUploadFeedback('Sélectionnez un profil éditable pour supprimer sa photo.', 'error')
      return
    }

    const confirmText = `Supprimer la photo de profil pour ${personId} ?`
    if (!confirm(confirmText)) return

    setUploadFeedback('Suppression en cours…', 'saving')
    try {
      const url = `/ api / document ? personId = ${encodeURIComponent(personId)} `
      const resp = await fetch(url, { method: 'DELETE' })
      if (!resp.ok) {
        let message = `Erreur serveur(${resp.status})`
        try {
          const payload = await resp.json()
          if (payload?.message) message = payload.message
        } catch (e) { }
        throw new Error(message)
      }

      // Clear uploader UI and remove image from active datum
      clearUploadResult()
      setUploadFeedback('Photo supprimée.', 'success')
      // If the active datum had the image URL in its data, remove it
      try {
        const targetFieldId = getActiveImageFieldId()
        if (datum && datum.data && datum.data[targetFieldId]) {
          delete datum.data[targetFieldId]
          chart.updateTree({ initial: false, tree_position: 'inherit' })
          scheduleAutoSave()
        }
      } catch (e) {
        /* ignore */
      }
    } catch (error) {
      console.error(error)
      setUploadFeedback(error.message || 'Échec de la suppression.', 'error')
    }
  })

  // manual URL input removed: no manual apply/copy behavior

  const previousApplyingState = isApplyingConfig
  isApplyingConfig = true
  ensureConfigEditableItems()
  refreshConfigControls()
  applyConfigToEditableControls()
  applyConfigToDisplayControls()
  isApplyingConfig = previousApplyingState

  applyEditableFields({ suppressSave: true })

  setMainProfileHandler = setMainProfile

  return {
    refreshMainProfileOptions,
    syncMainProfileSelection,
    handleFormCreation,
    teardown: teardownImageUploader
  }
}

function removeUnionParagraphField(values = []) {
  return values.filter(value => normalizeFieldKey(value) !== UNION_PARAGRAPH_KEY)
}

async function initialise() {
  destroyTimer()
  editTreeInstance = null
  lastSnapshotString = null

  try {
    let payload = await loadTree()

    // Validate and Repair Data (data is inside payload.data usually)
    let persons = Array.isArray(payload.data) ? payload.data : []
    persons = validateAndRepairData(persons)
    payload.data = persons

    // Ensure mainId is valid after repair. If missing or invalid, default to first person.
    if (persons.length > 0) {
      if (!chartConfig.mainId || !persons.some(d => d.id === chartConfig.mainId)) {
        const newMain = persons[0].id
        console.warn(`[Builder] Main ID ${chartConfig.mainId} invalid or missing. Resetting to ${newMain}.`)
        chartConfig.mainId = newMain
      }
    } else {
      // Empty data
      chartConfig.mainId = null
    }

    // Sync payload config with our local valid chartConfig to prevent setupChart from overwriting it with stale data
    if (!payload.config) payload.config = {}
    payload.config.mainId = chartConfig.mainId

    setupChart(payload)
  } catch (error) {
    console.error(error)
    setStatus(`Erreur: ${error.message} `, 'error')
    setChartLoading(false, 'Erreur')
  }
}

function validateAndRepairData(data) {
  if (!Array.isArray(data)) return []
  const validIds = new Set(data.map(d => d.id))
  const newStubs = []

  data.forEach(d => {
    // Check main rels property
    if (d.rels) {
      ['parents', 'children', 'spouses'].forEach(key => {
        if (Array.isArray(d.rels[key])) {
          d.rels[key].forEach(relId => {
            if (!validIds.has(relId)) {
              if (!newStubs.some(s => s.id === relId)) {
                newStubs.push({
                  id: relId,
                  data: {
                    'first name': '...',
                    'last name': ''
                  },
                  rels: {}
                })
                validIds.add(relId)
              }
            }
          })
        }
      })
    }
  })

  if (newStubs.length > 0) {
    console.warn(`[DataRepair] Created ${newStubs.length} stubs for off-screen relationships.`)
    setStatus(`Chargement partiel (${newStubs.length} personnes masquées)`, 'success')
    return [...data, ...newStubs]
  }
  return data
}


saveBtn?.addEventListener('click', () => {
  const snapshot = getSnapshot()
  if (!snapshot) return
  persistChanges(snapshot, { immediate: true })
})

reloadBtn?.addEventListener('click', () => {
  initialise()
})

function hasUnsavedChanges() {
  const snapshot = getSnapshot()
  if (!snapshot) return false
  const currentString = JSON.stringify(snapshot)
  return currentString !== lastSnapshotString
}

window.addEventListener('beforeunload', (event) => {
  if (!hasUnsavedChanges()) return
  event.preventDefault()
  event.returnValue = ''
})

initialise()

// Tool Buttons Logic
// Helper for Selective Import Modal
function openSelectiveImportModal(importedData, targetName, onConfirm) {
  const modal = document.getElementById('importSelectionModal')
  const candidatesList = document.getElementById('importCandidatesList')
  const confirmBtn = document.getElementById('confirmImportBtn')
  const cancelBtn = document.getElementById('cancelImportBtn')
  const nameSpan = document.getElementById('importTargetName')
  const searchInput = document.getElementById('importSearch')

  if (!modal || !candidatesList) return

  // Reset state
  candidatesList.innerHTML = ''
  confirmBtn.disabled = true
  searchInput.value = ''
  nameSpan.textContent = targetName || 'Inconnu'
  let selectedId = null

  // Populate list
  function renderList(filter = '') {
    candidatesList.innerHTML = ''
    const filterLower = filter.toLowerCase()
    importedData.forEach(p => {
      const name = `${p.data['first name'] || ''} ${p.data['last name'] || ''} `.trim() || 'Inconnu'
      const id = p.id
      if (filter && !name.toLowerCase().includes(filterLower)) return

      const div = document.createElement('div')
      div.className = 'candidate-item'
      div.dataset.id = id
      div.textContent = `${name} (ID: ${id})`
      if (id === selectedId) div.classList.add('selected')

      div.addEventListener('click', () => {
        document.querySelectorAll('.candidate-item').forEach(el => el.classList.remove('selected'))
        div.classList.add('selected')
        selectedId = id
        confirmBtn.disabled = false
      })
      candidatesList.appendChild(div)
    })
  }

  renderList()

  searchInput.oninput = (e) => renderList(e.target.value)

  // Handlers
  const cleanup = () => {
    modal.close()
    confirmBtn.onclick = null
    cancelBtn.onclick = null
    searchInput.oninput = null
  }

  confirmBtn.onclick = () => {
    if (selectedId) {
      const direction = document.querySelector('input[name="importDirection"]:checked').value
      onConfirm(selectedId, direction)
      cleanup()
    }
    // ... code continues
  }

  cancelBtn.onclick = () => {
    cleanup()
  }

  modal.showModal()
}

// Tool Buttons Logic
const tools = {
  deleteBranch: (direction) => {
    if (!activeChartInstance) return
    const store = activeChartInstance.store
    const mainId = store.getMainId()
    if (!mainId) return alert('Veuillez sélectionner une personne d\'abord.')

    if (!confirm(`Êtes - vous sûr de vouloir supprimer la branche ${direction === 'asc' ? 'ascendance' : 'descendance'} de la personne sélectionnée ? Cette action est irréversible.`)) return

    const data = store.getData()
    const idsToDelete = new Set()

    const traverse = (id) => {
      idsToDelete.add(id)
      const datum = data.find(d => d.id === id)
      if (!datum) return

      if (direction === 'asc') {
        // Delete parents recursively
        datum.rels.parents?.forEach(traverse)
      } else {
        // Delete children recursively
        datum.rels.children?.forEach(traverse)
      }
    }

    const mainDatum = data.find(d => d.id === mainId)
    if (mainDatum) {
      if (direction === 'asc') {
        mainDatum.rels.parents?.forEach(traverse)
        mainDatum.rels.parents = [] // Clear connection
      } else {
        mainDatum.rels.children?.forEach(traverse)
        mainDatum.rels.children = [] // Clear connection
      }
    }

    const newData = data.filter(d => !idsToDelete.has(d.id))
    store.updateData(newData)
    activeChartInstance.updateTree()

    const snapshot = getSnapshot()
    if (snapshot) persistChanges(snapshot, { immediate: true })

    alert('Branche supprimée avec succès.')
  },

  importBranch: () => {
    console.log('Builder: importBranch clicked')
    if (!activeChartInstance) return
    const store = activeChartInstance.store
    const mainId = store.getMainId()
    if (!mainId) return alert('Veuillez sélectionner une personne d\'abord.')

    const currentData = store.getData()
    const mainDatum = currentData.find(d => d.id === mainId)
    const mainName = mainDatum ? `${mainDatum.data['first name']} ${mainDatum.data['last name']} ` : mainId

    setStatus('Sélection du fichier...', 'saving')

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.ged'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const content = event.target.result

          if (!window.GedcomParser) throw new Error('Le parseur GEDCOM n\'est pas chargé.')
          const parser = new window.GedcomParser()
          const importedData = parser.parse(content)

          setStatus('Analyse de la branche...', 'saving')

          if (!importedData || importedData.length === 0) throw new Error('Fichier GEDCOM vide ou invalide')

          // Open Modal to select the link target in the imported file
          openSelectiveImportModal(importedData, mainName, (selectedImportId, direction) => {
            // Logic to merge based on selection
            const importedRoot = importedData.find(d => d.id === selectedImportId)
            if (!importedRoot) return

            // Refactoring IDs to UUIDs to avoid any collision
            // We must rewrite ALL IDs in the imported set
            const idMap = new Map() // Old ID -> New UUID

            importedData.forEach(d => {
              const newId = crypto.randomUUID()
              idMap.set(d.id, newId)
              d.id = newId
            })

            // Update relationships with new IDs
            importedData.forEach(d => {
              if (d.rels) {
                if (d.rels.parents) d.rels.parents = d.rels.parents.map(pid => idMap.get(pid) || pid).filter(id => idMap.has(pid) || true)
                if (d.rels.children) d.rels.children = d.rels.children.map(cid => idMap.get(cid) || cid)
                if (d.rels.spouses) d.rels.spouses = d.rels.spouses.map(sid => idMap.get(sid) || sid)
              }
            })

            const remappedRootId = idMap.get(selectedImportId)
            const remappedRoot = importedData.find(d => d.id === remappedRootId)

            if (direction === 'asc') {
              // LINK: Imported Root is ASCENDANT (Parent) of Selected Person
              // 1. Add remappedRoot as parent of mainDatum
              if (!mainDatum.rels.parents) mainDatum.rels.parents = []
              if (!mainDatum.rels.parents.includes(remappedRootId)) {
                mainDatum.rels.parents.push(remappedRootId)
              }

              // 2. Add mainDatum as child of remappedRoot
              if (!remappedRoot.rels.children) remappedRoot.rels.children = []
              if (!remappedRoot.rels.children.includes(mainId)) {
                remappedRoot.rels.children.push(mainId)
              }
            } else {
              // LINK: Imported Root is DESCENDANT (Child) of Selected Person
              // 1. Add remappedRoot as child of mainDatum
              if (!mainDatum.rels.children) mainDatum.rels.children = []
              if (!mainDatum.rels.children.includes(remappedRootId)) {
                mainDatum.rels.children.push(remappedRootId)
              }

              // 2. Add mainDatum as parent of remappedRoot
              if (!remappedRoot.rels.parents) remappedRoot.rels.parents = []
              if (!remappedRoot.rels.parents.includes(mainId)) {
                remappedRoot.rels.parents.push(mainId)
              }
            }

            const combinedData = [...currentData, ...importedData]
            store.updateData(combinedData)
            activeChartInstance.updateTree()

            const snapshot = getSnapshot()
            if (snapshot) persistChanges(snapshot, { immediate: true })

            setStatus('Branche fusionnée et sauvegardée !', 'success')
          })

        } catch (err) {
          console.error(err)
          setStatus('Erreur d\'importation', 'error')
          alert('Erreur lors de l\'importation GEDCOM : ' + err.message)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  },

  exportTree: () => {
    if (!activeChartInstance) return
    const data = activeChartInstance.store.getData()
    const parser = new GedcomParser()
    const gedcom = parser.generate(data)

    const blob = new Blob([gedcom], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `family - tree - ${new Date().toISOString().split('T')[0]}.ged`
    a.click()
    URL.revokeObjectURL(url)
  },

  importTree: () => {
    if (!confirm('Attention, cela remplacera tout l\'arbre actuel. Continuer ?')) return

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.ged'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return

      setStatus('Lecture du fichier...', 'saving')
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          setStatus('Analyse du GEDCOM...', 'saving')
          const content = event.target.result
          // Instantiate parser (assuming loaded via script tag as window.GedcomParser)
          if (!window.GedcomParser) throw new Error('Le parseur GEDCOM n\'est pas chargé.')
          const parser = new window.GedcomParser()
          const data = parser.parse(content)

          setStatus('Envoi des données...', 'saving')
          const payload = {
            data: data,
            config: {},
            meta: { source: 'gedcom-client-import', filename: file.name }
          }

          const response = await fetch('/api/admin/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })

          if (!response.ok) {
            const err = await response.json()
            throw new Error(err.message || response.statusText)
          }

          setStatus('Import réussi ! Rechargement...', 'success')
          alert('Arbre GEDCOM importé avec succès. La page va se recharger.')
          window.location.reload()
        } catch (error) {
          console.error(error)
          setStatus('Erreur d\'importation (Client)', 'error')
          alert('Erreur lors de l\'importation : ' + error.message)
        }
      }
      reader.onerror = () => {
        setStatus('Erreur de lecture du fichier', 'error')
        alert('Impossible de lire le fichier local.')
      }
      reader.readAsText(file)
    }
    input.click()
  }
}

// Event Listeners for Tools
function setupToolListeners() {
  console.log('Builder: setupToolListeners called')
  const actions = {
    'delete-branch-asc': () => tools.deleteBranch('asc'),
    'delete-branch-desc': () => tools.deleteBranch('desc'),
    'import-branch': () => tools.importBranch(),
    'import-tree': () => tools.importTree(),
    'export-tree': () => tools.exportTree()
  }

  Object.entries(actions).forEach(([action, handler]) => {
    const btn = document.querySelector(`[data-action="${action}"]`)
    if (btn) {
      // Remove existing listeners to avoid duplicates if re-run
      const newBtn = btn.cloneNode(true)
      btn.parentNode.replaceChild(newBtn, btn)
      newBtn.addEventListener('click', handler)
    }
  })
}

// --- Tab System ---
function setupTabs() {
  const tabs = document.querySelectorAll('[data-tab]')
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const group = tab.closest('.tabs-nav')
      if (!group) return

      // Deactivate siblings
      group.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')

      const targetName = tab.dataset.tab
      const container = group.parentElement
      if (!container) return

      const contents = container.querySelectorAll('.tab-content')
      contents.forEach(content => {
        if (content.dataset.tabContent === targetName) {
          content.classList.add('active')
        } else {
          content.classList.remove('active')
        }
      })
    })
  })
}

// Initialize tools when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupToolListeners()
    setupTabs()
    setupFileManagement()
  })
} else {
  setupToolListeners()
  setupTabs()
  setupFileManagement()
}

// --- File Management System ---
// Tracks the person currently being edited (set via handleFormCreation hook)
window.builderCurrentPersonId = null

async function loadBuilderFiles(personId) {
  const container = document.getElementById('builderFilesList')
  const empty = document.getElementById('builderFilesEmpty')
  if (!container || !empty) return

  if (!personId) {
    container.innerHTML = ''
    empty.textContent = 'Aucun profil sélectionné.'
    empty.classList.remove('hidden')
    return
  }

  container.innerHTML = '<div class="loader">Chargement...</div>'
  empty.classList.add('hidden')

  try {
    const res = await fetch(`/api/documents/${personId}`)
    if (!res.ok) throw new Error('Erreur réseau')
    const files = await res.json()

    container.innerHTML = ''
    if (files.length === 0) {
      empty.textContent = 'Aucun fichier associé.'
      empty.classList.remove('hidden')
    } else {
      files.forEach(file => {
        const div = document.createElement('div')
        div.className = 'file-item'
        const icon = file.isProfile ? '🖼️' : '📄'
        div.innerHTML = `
           <a href="${file.url}" target="_blank" class="file-link" title="${file.name}">
             ${icon} ${file.name}
           </a>
           <button class="delete-btn" type="button" aria-label="Supprimer">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
           </button>
         `
        div.querySelector('.delete-btn').addEventListener('click', (e) => {
          e.stopPropagation()
          deleteBuilderFile(personId, file.name)
        })
        container.appendChild(div)
      })
    }
  } catch (e) {
    console.error(e)
    container.innerHTML = '<div class="error">Impossible de charger les fichiers.</div>'
  }
}

async function uploadBuilderFile(file) {
  const personId = window.builderCurrentPersonId || activeChartInstance?.store?.getMainId()

  if (!personId) return alert('Veuillez sélectionner une personne dans l\'arbre.')

  setStatus('Téléversement...', 'saving')
  const formData = new FormData()
  formData.append('file', file)
  formData.append('personId', personId)
  formData.append('isProfile', 'false')

  try {
    const res = await fetch('/api/document', { method: 'POST', body: formData })
    if (!res.ok) throw new Error('Erreur lors du téléversement')
    setStatus('Fichier ajouté !', 'success')
    loadBuilderFiles(personId)
  } catch (e) {
    setStatus('Erreur: ' + e.message, 'error')
  }
}

async function deleteBuilderFile(personId, filename) {
  if (!confirm(`Voulez-vous vraiment supprimer ${filename} ?`)) return
  try {
    const res = await fetch(`/api/document?personId=${personId}&filename=${encodeURIComponent(filename)}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Erreur lors de la suppression')
    loadBuilderFiles(personId)
  } catch (e) {
    alert(e.message)
  }
}

function setupFileManagement() {
  const btn = document.querySelector('[data-action="upload-file"]')
  const input = document.getElementById('fileInputHidden')

  if (btn && input) {
    btn.addEventListener('click', () => {
      const pid = window.builderCurrentPersonId || activeChartInstance?.store?.getMainId()
      if (!pid) {
        alert('Veuillez d\'abord sélectionner une personne affichée.')
        return
      }
      input.click()
    })
    input.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        Array.from(e.target.files).forEach(uploadBuilderFile)
        input.value = ''
      }
    })
  }

  const filesTab = document.querySelector('[data-tab="files"]')
  if (filesTab) {
    filesTab.addEventListener('click', () => {
      const pid = window.builderCurrentPersonId || activeChartInstance?.store?.getMainId()
      loadBuilderFiles(pid)
    })
  }

  // Also hook into initial DOMContentLoaded to setup default ID if needed?
  // Not strictly necessary as click handles it.
}

