import * as f3 from '/lib/family-tree.esm.js'

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
  return String(value).replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`)
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
      chartLoadingLabel.textContent = message || 'Chargement…'
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

  if (!persistSelection && shouldUpdateMain) {
    ignoreNextMainSync = true
  }

  if (shouldUpdateMain) {
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
    placeholder.textContent = 'Sélectionnez une personne pour afficher son parcours.'
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
  if (!storage) return false
  try {
    return storage.getItem(CONTROL_PANEL_STATE_KEY) === '1'
  } catch (error) {
    return false
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
    // storage errors can be ignored silently
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
    panelToggleBtn.textContent = collapsed ? 'Afficher le panneau' : 'Replier le panneau'
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

// Fields that should be hidden from the builder/editor UI
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
  { value: 'bio', label: 'Biographie', checked: false }
  ,{ value: 'union paragraph', label: "Paragraphe d'union", checked: true }
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

const TEXTAREA_FIELD_KEYS = new Set(['bio', 'notes', 'biographie', 'description', 'union paragraph'])
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
      addMeta(`✝ ${trimmed}`)
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
      const meta = safeMetaParts.length ? `<small>${safeMetaParts.join(' · ')}</small>` : ''
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

        // Don't use the global status bar for search results to avoid overwriting
        // the persistent editor status located at the bottom of the panel.

        try {
          const input = searchTarget.querySelector('input')
          if (input) {
            input.value = ''
            input.blur()
          }
        } catch (e) {
          /* ignore */
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
      // support explicit newlines in messages -> render as line breaks
      statusEl.innerHTML = message.replace(/\n/g, '<br>')
    } else if (Array.isArray(message)) {
      statusEl.innerHTML = message.map(m => String(m)).join('<br>')
    } else {
      statusEl.textContent = String(message)
    }
  } catch (e) {
    // fallback to plain text
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

async function loadTree() {
  setStatus('Chargement des données…')
  setChartLoading(true, 'Chargement des données…')
  const response = await fetch('/api/tree', { cache: 'no-store' })
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
    /* ignore */
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

  // When clicking a card in the builder:
  // - open the editor for that person
  // - highlight the clicked person
  // - populate and focus the builder search input so the UX mirrors the viewer
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
    refreshMainProfileOptions: () => {},
    syncMainProfileSelection: () => {},
    handleFormCreation: () => {},
    teardown: () => {}
  }

  searchControlAPI = initBuilderSearch(chart)

  if (typeof panelControlAPI.teardown === 'function') {
    activePanelTeardown = panelControlAPI.teardown
  } else {
    activePanelTeardown = null
  }

  if (typeof panelControlAPI.handleFormCreation === 'function') {
    editTreeInstance.setOnFormCreation(panelControlAPI.handleFormCreation)
  }

  const initialMainId = resolveInitialMainId(dataArray, chart)
  if (initialMainId) {
    chart.updateMainId(initialMainId)
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

  const mainDatum = chart.getMainDatum()
  if (mainDatum) {
    editTreeInstance.open(mainDatum)
  }
  renderBreadcrumbTrail(chart.store?.getMainId?.() || initialMainId || null)

  const initialSnapshot = getSnapshot()
  lastSnapshotString = initialSnapshot ? JSON.stringify(initialSnapshot) : null
  const totalPersons = dataArray.length
  setStatus(
    totalPersons > 0
      ? `Éditeur prêt ✅ –\n${totalPersons} personne(s) chargée(s)`
      : 'Fichier de données vide',
    totalPersons > 0 ? 'success' : 'error'
  )
  setChartLoading(false)

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
      refreshMainProfileOptions: () => {},
      syncMainProfileSelection: () => {},
      handleFormCreation: () => {},
      teardown: () => {}
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
  const imageUploader = panel.querySelector('[data-role="image-uploader"]')
  const assetUploadInput = imageUploader?.querySelector('#assetUpload')
  const assetUploadFeedback = imageUploader?.querySelector('[data-role="upload-feedback"]')
  const assetUploadResult = imageUploader?.querySelector('[data-role="upload-result"]')
  const assetUploadUrlOutput = imageUploader?.querySelector('[data-role="upload-url"]')
  const assetUploadOpenLink = imageUploader?.querySelector('[data-role="open-upload"]')
  const copyUploadUrlBtn = imageUploader?.querySelector('[data-action="copy-upload-url"]')
  const manualUrlInput = imageUploader?.querySelector('#assetUrl')
  const copyManualUrlBtn = imageUploader?.querySelector('[data-action="copy-manual-url"]')

  const imageUploaderHome = imageUploader ? {
    parent: imageUploader.parentElement,
    nextSibling: imageUploader.nextSibling
  } : null

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
      console.error('Impossible de récupérer le profil actif pour le téléversement', error)
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
      const targetInput = imageUploaderCurrentForm.querySelector(`[name="${escapedFieldId}"]`)
      if (targetInput && targetInput instanceof HTMLInputElement) {
        if (targetInput.value !== absoluteUrl) {
          targetInput.value = absoluteUrl
          targetInput.dispatchEvent(new Event('input', { bubbles: true }))
        }
        formUpdated = true
      } else if (targetInput && targetInput instanceof HTMLTextAreaElement) {
        if (targetInput.value !== absoluteUrl) {
          targetInput.value = absoluteUrl
          targetInput.dispatchEvent(new Event('input', { bubbles: true }))
        }
        formUpdated = true
      }
    }

    const activeDatum = getActiveDatum()
    if (activeDatum) {
      if (!activeDatum.data) activeDatum.data = {}
      if (activeDatum.data[targetFieldId] !== absoluteUrl) {
        activeDatum.data[targetFieldId] = absoluteUrl
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

    if (manualUrlInput) manualUrlInput.value = absoluteUrl

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
      setStatus('Image appliquée au profil ✅', 'success')
    } else {
      setUploadFeedback('Sélectionnez un profil éditable pour appliquer l’image.', 'info')
    }
  }

  function populateUploaderFromDatum() {
    const targetFieldId = getActiveImageFieldId()
    const activeDatum = getActiveDatum()
    const existingValue = activeDatum?.data?.[targetFieldId] || ''

    if (!existingValue) {
      clearUploadResult()
      if (manualUrlInput) manualUrlInput.value = ''
      setUploadFeedback('Formats recommandés : JPG, PNG, WebP.', 'info')
      return
    }

    const absoluteUrl = showUploadResult(existingValue, { silent: true })
    if (manualUrlInput) manualUrlInput.value = absoluteUrl
    setUploadFeedback('Image actuelle du profil chargée.', 'info')
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
    if (manualUrlInput) manualUrlInput.value = ''
    setUploadFeedback('Importez une image ou collez une URL publique. Formats recommandés : JPG, PNG, WebP.', 'info')
  }

  function injectImageUploaderIntoForm(form) {
    if (!imageUploader || !form) return
    if (imageUploaderCurrentForm === form) return

    restoreImageUploaderToPanel()

    const buttons = form.querySelector('.f3-form-buttons')
    if (buttons && buttons.parentNode) {
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
      // helpful debug output when a form is created by the chart
      console.debug('builder: handleFormCreation form_creator.editable=', form_creator?.editable, 'datum_id=', form_creator?.datum_id)
      console.debug('builder: form_creator.fields', form_creator?.fields)
    } catch (e) {
      /* ignore */
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

    // Set example placeholder for date-like inputs in builder forms
    try {
      const datePlaceholder = 'ex : 30.12.2000'
      const inputs = [...form.querySelectorAll('input[name], textarea[name]')]
      inputs.forEach(el => {
        const name = (el.getAttribute('name') || '').toLowerCase()
        // try to find a nearby label text
        let labelText = ''
        try {
          const id = el.getAttribute('id')
          if (id) {
            const lbl = form.querySelector(`label[for="${escapeSelector(id)}"]`)
            if (lbl && lbl.textContent) labelText = lbl.textContent.trim().toLowerCase()
          }
        } catch (e) {
          /* ignore */
        }

        const combined = `${name} ${labelText}`
        // match common date-like keys/labels
        if (/\b(birth|birthday|death|union|marri|wedding|anniv|date)\b/.test(combined)) {
          if (!el.getAttribute('placeholder') || el.getAttribute('placeholder').trim() === '') {
            el.setAttribute('placeholder', datePlaceholder)
          }
        }
      })
    } catch (e) {
      /* ignore placeholder errors */
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
    if (manualUrlInput) manualUrlInput.value = absoluteUrl
    if (!silent) setUploadFeedback('Image prête à être appliquée.', 'info')

    return absoluteUrl
  }

  async function copyToClipboard(value, { successMessage = 'Copié dans le presse-papiers ✅', errorMessage = 'Impossible de copier.' } = {}) {
    if (!value) {
      setUploadFeedback('Aucune URL à copier.', 'error')
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
      setUploadFeedback('Format non pris en charge. Sélectionnez une image (JPEG, PNG, WebP…).', 'error')
      return
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      setUploadFeedback(`Fichier trop volumineux (${formatBytes(file.size)}). Limite 5 Mo.`, 'error')
      return
    }

    setUploadFeedback('Téléversement en cours…', 'saving')
    setStatus('Téléversement de l’image…', 'saving')

    const formData = new FormData()
    formData.append('file', file, file.name)

    try {
      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        let message = `Erreur serveur (${response.status})`
        try {
          const payload = await response.json()
          if (payload?.message) message = payload.message
        } catch (error) {
          // ignore JSON parse errors
        }
        throw new Error(message)
      }

      const payload = await response.json()
      const uploadedUrl = payload?.url
      if (!uploadedUrl) {
        throw new Error('Réponse du serveur invalide (URL manquante).')
      }

      const absoluteUrl = showUploadResult(uploadedUrl)
      applyImageToActiveProfile(absoluteUrl, { origin: 'upload', sizeBytes: file.size })
    } catch (error) {
      console.error(error)
      setUploadFeedback(error.message || 'Échec du téléversement.', 'error')
      setStatus(`Téléversement échoué: ${error.message || 'Erreur inconnue'}`, 'error')
      clearUploadResult()
    }
  }

  clearUploadResult()
  if (assetUploadFeedback) {
    setUploadFeedback(assetUploadFeedback.textContent || 'Formats recommandés : JPG, PNG, WebP.', 'info')
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
    if (ancestryDepthSelect) ancestryDepthSelect.value = depthToSelectValue(chartConfig.ancestryDepth, DEFAULT_CHART_CONFIG.ancestryDepth)
    if (progenyDepthSelect) progenyDepthSelect.value = depthToSelectValue(chartConfig.progenyDepth, DEFAULT_CHART_CONFIG.progenyDepth)
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
      mainProfileName.textContent = '—'
      return
    }
    const datum = editTreeInstance?.store?.getDatum?.(id)
    if (!datum) {
      mainProfileName.textContent = '—'
      return
    }
    mainProfileName.textContent = buildPersonLabel(datum)
  }

  function refreshMainProfileOptions({ keepSelection = true } = {}) {
    if (!mainProfileSelect) return
    const persons = getAllPersons()
    const previousValue = keepSelection ? mainProfileSelect.value : ''
    clearElement(mainProfileSelect)

    if (!persons.length) {
      const placeholder = document.createElement('option')
      placeholder.value = ''
      placeholder.textContent = 'Aucune personne disponible'
      mainProfileSelect.append(placeholder)
      mainProfileSelect.disabled = true
      updateMainProfileDisplay(null)
      return
    }

    const fragment = document.createDocumentFragment()
    persons.forEach(datum => {
      if (!datum || !datum.id) return
      const option = document.createElement('option')
      option.value = datum.id
      option.textContent = buildPersonLabel(datum)
      fragment.append(option)
    })
    mainProfileSelect.append(fragment)
    mainProfileSelect.disabled = false

    const availableIds = new Set(persons.map(d => d.id))
    const preferred = []
    if (keepSelection && previousValue && availableIds.has(previousValue)) preferred.push(previousValue)

    const configMain = typeof chartConfig.mainId === 'string' ? chartConfig.mainId : ''
    if (configMain && availableIds.has(configMain)) preferred.push(configMain)

    const storeMainId = chart.store && typeof chart.store.getMainId === 'function' ? chart.store.getMainId() : ''
    if (storeMainId && availableIds.has(storeMainId)) preferred.push(storeMainId)

    if (persons[0]?.id) preferred.push(persons[0].id)

    const targetValue = preferred.find(Boolean) || ''
    if (targetValue) {
      mainProfileSelect.value = targetValue
    } else {
      mainProfileSelect.selectedIndex = 0
    }

    updateMainProfileDisplay(mainProfileSelect.value || null)
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

    if (!ignoreNextMainSync && storeMainId && availableIds.has(storeMainId)) {
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
      if (nextConfigMain && ![...mainProfileSelect.options].some(option => option.value === nextConfigMain)) {
        refreshMainProfileOptions({ keepSelection: false })
      }

      if (!nextConfigMain && !mainProfileSelect.options.length) {
        refreshMainProfileOptions({ keepSelection: false })
      }

      if (nextConfigMain) {
        mainProfileSelect.value = nextConfigMain
        mainProfileSelect.disabled = false
      }
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
    const persons = getAllPersons()
    if (!persons.some(person => person.id === id)) {
      refreshMainProfileOptions({ keepSelection: false })
      return
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
    // Only update the chart main id when we persist the main profile in config
    // or when a caller explicitly requests this via `persistConfig`.
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
    // Ensure the chart recenters on the selected person (match viewer behaviour).
    // If the main id was already set, callers may still expect a recenter.
    try {
      if (!recenterAlreadyScheduled && chart && typeof chart.updateTree === 'function') {
        chart.updateTree({ initial: false, tree_position: 'main_to_middle' })
      }
    } catch (error) {
      console.error('Impossible de recentrer le graphique après sélection du profil', error)
    }
    const datum = editTreeInstance?.store?.getDatum?.(id) || null
    if (focusSearch) {
      const label = datum ? buildPersonLabel(datum) : `Profil ${id}`
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
        const selector = `[data-field-key="${escapeSelector(fallbackKey)}"] input[type="checkbox"]`
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

    const datum = editTreeInstance.store.getMainDatum()
    if (datum) editTreeInstance.open(datum)
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

  ancestryDepthSelect?.addEventListener('change', () => {
    if (isApplyingConfig) return
    const fallback = chartConfig.ancestryDepth ?? DEFAULT_CHART_CONFIG.ancestryDepth ?? null
    const value = parseDepthSelectValue(ancestryDepthSelect, fallback)
    if (value === chartConfig.ancestryDepth) return
    commitConfigUpdate({ ancestryDepth: value }, { treePosition: 'main_to_middle' })
  })

  progenyDepthSelect?.addEventListener('change', () => {
    if (isApplyingConfig) return
    const fallback = chartConfig.progenyDepth ?? DEFAULT_CHART_CONFIG.progenyDepth ?? null
    const value = parseDepthSelectValue(progenyDepthSelect, fallback)
    if (value === chartConfig.progenyDepth) return
    commitConfigUpdate({ progenyDepth: value }, { treePosition: 'main_to_middle' })
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

  copyUploadUrlBtn?.addEventListener('click', () => {
    const storedUrl = assetUploadResult?.dataset?.url || assetUploadUrlOutput?.textContent?.trim()
    if (storedUrl) applyImageToActiveProfile(storedUrl, { origin: 'manual' })
    copyToClipboard(storedUrl, {
      successMessage: 'URL du téléversement copiée ✅',
      errorMessage: 'Impossible de copier l’URL du téléversement.'
    })
  })

  copyManualUrlBtn?.addEventListener('click', () => {
    const value = manualUrlInput?.value?.trim()
    if (value) applyImageToActiveProfile(value, { origin: 'manual' })
    copyToClipboard(value, {
      successMessage: 'Image appliquée et URL copiée ✅',
      errorMessage: 'Impossible de copier ce lien.'
    })
  })

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
    const data = await loadTree()
    setupChart(data)
  } catch (error) {
    console.error(error)
    setStatus(`Erreur: ${error.message}`, 'error')
    setChartLoading(false, 'Erreur')
  }
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
