import * as f3 from '/lib/family-tree.esm.js'

const statusEl = document.getElementById('status')
const detailsPanel = document.getElementById('personDetails')
const searchContainer = document.getElementById('personSearch')
const searchHint = document.getElementById('personSearchHint')
const searchRoot = document.querySelector('[data-role="viewer-search"]')
const searchEmptyEl = document.querySelector('[data-role="viewer-search-empty"]')
const detailsList = detailsPanel?.querySelector('.detail-list')
const detailsSummary = detailsPanel?.querySelector('.summary')
const emptyState = detailsPanel?.querySelector('.empty')
const chartSelector = '#FamilyChart'
const ancestryDepthControl = document.getElementById('viewerAncestryDepth')
const progenyDepthControl = document.getElementById('viewerProgenyDepth')
const miniTreeToggle = document.getElementById('viewerMiniTree')
const autoCenterToggle = document.getElementById('viewerAutoCenter')
const datasetMeta = document.querySelector('[data-role="dataset-meta"]')
const visibleCountEl = document.querySelector('[data-role="visible-count"]')
const branchCountEl = document.querySelector('[data-role="branch-count"]')
const totalCountEl = document.querySelector('[data-role="total-count"]')
const panelToggleBtn = document.querySelector('[data-action="toggle-panel"]')

const VIEWER_PANEL_STATE_KEY = 'family-tree:viewer:panelCollapsed'
const SUBTREE_CACHE_TTL = 120000
const SUBTREE_CACHE_MAX_ENTRIES = 32
const subtreeCache = new Map()
let currentDatasetSignature = null

function clearElement(target) {
  if (!target) return
  while (target.firstChild) {
    target.removeChild(target.firstChild)
  }
}

function getViewerStorageSafe() {
  try {
    return window.localStorage
  } catch (error) {
    return null
  }
}

function getViewerPref(key, fallback) {
  const storage = getViewerStorageSafe()
  if (!storage) return fallback
  try {
    const raw = storage.getItem(`family-tree:viewer:${key}`)
    if (raw === null) return fallback
    if (raw === '1' || raw === 'true') return true
    if (raw === '0' || raw === 'false') return false
    return raw
  } catch (e) {
    return fallback
  }
}

function setViewerPref(key, value) {
  const storage = getViewerStorageSafe()
  if (!storage) return
  try {
    if (value === true || value === false) storage.setItem(`family-tree:viewer:${key}`, value ? '1' : '0')
    else storage.setItem(`family-tree:viewer:${key}`, String(value))
  } catch (e) {
  }
}

function readPanelCollapsedState() {
  const storage = getViewerStorageSafe()
  if (!storage) return false
  try {
    return storage.getItem(VIEWER_PANEL_STATE_KEY) === '1'
  } catch (error) {
    return false
  }
}

function writePanelCollapsedState(collapsed) {
  const storage = getViewerStorageSafe()
  if (!storage) return
  try {
    if (collapsed) {
      storage.setItem(VIEWER_PANEL_STATE_KEY, '1')
    } else {
      storage.removeItem(VIEWER_PANEL_STATE_KEY)
    }
  } catch (error) {
  }
}

function applyPanelCollapsedState(collapsed) {
  if (collapsed) {
    document.body.classList.add('viewer-details-collapsed')
  } else {
    document.body.classList.remove('viewer-details-collapsed')
  }
  if (panelToggleBtn) {
    panelToggleBtn.setAttribute('aria-expanded', String(!collapsed))
    const span = panelToggleBtn.querySelector('span')
    if (span) {
      span.textContent = collapsed ? 'Afficher' : 'Masquer'
    } else {
      panelToggleBtn.title = collapsed ? 'Afficher le panneau' : 'Masquer le panneau'
    }
  }
  if (detailsPanel) {
    if (collapsed) {
      detailsPanel.setAttribute('aria-hidden', 'true')
      detailsPanel.hidden = true
    } else {
      detailsPanel.removeAttribute('aria-hidden')
      detailsPanel.hidden = false
    }
  }
}

function togglePanelCollapsed(force) {
  const next = typeof force === 'boolean' ? force : !document.body.classList.contains('viewer-details-collapsed')
  applyPanelCollapsedState(next)
  writePanelCollapsedState(next)
}

const initialPanelCollapsed = readPanelCollapsedState()
applyPanelCollapsedState(initialPanelCollapsed)
if (panelToggleBtn) {
  panelToggleBtn.addEventListener('click', () => togglePanelCollapsed())
}

function normalizeFieldKey(value) {
  if (value === undefined || value === null) return ''
  return String(value).trim().toLowerCase()
}

function canonicalFieldKey(value) {
  return normalizeFieldKey(value).replace(/[\s_-]+/g, '')
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

function safeTrim(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function clearSubtreeCache() {
  subtreeCache.clear()
}

function deriveDatasetSignature(metaInfo) {
  if (!metaInfo || typeof metaInfo !== 'object') return null
  const candidates = [
    metaInfo.datasetId,
    metaInfo.version,
    metaInfo.generatedAt,
    metaInfo.hash,
    metaInfo.total
  ]
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) {
      return String(candidate)
    }
  }
  return null
}

function updateCacheSignature(metaInfo) {
  const nextSignature = deriveDatasetSignature(metaInfo)
  if (!nextSignature) return
  if (currentDatasetSignature && currentDatasetSignature !== nextSignature) {
    currentDatasetSignature = nextSignature
    clearSubtreeCache()
    return
  }
  if (!currentDatasetSignature) {
    currentDatasetSignature = nextSignature
  }
}

function cloneForCache(value) {
  if (value === undefined || value === null) return value
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(value)
    }
  } catch (error) {
  }
  try {
    return JSON.parse(JSON.stringify(value))
  } catch (error) {
    return value
  }
}

function setSubtreeCache(key, payload, metaInfo) {
  if (!key) return
  const entry = {
    payload: cloneForCache(payload),
    meta: cloneForCache(metaInfo),
    timestamp: Date.now(),
    signature: currentDatasetSignature
  }
  subtreeCache.set(key, entry)
  if (subtreeCache.size > SUBTREE_CACHE_MAX_ENTRIES) {
    const oldestKey = subtreeCache.keys().next().value
    if (oldestKey !== undefined) {
      subtreeCache.delete(oldestKey)
    }
  }
}

function getCachedSubtree(key) {
  if (!key) return null
  const entry = subtreeCache.get(key)
  if (!entry) return null
  if (entry.signature && currentDatasetSignature && entry.signature !== currentDatasetSignature) {
    subtreeCache.delete(key)
    return null
  }
  if (Date.now() - entry.timestamp > SUBTREE_CACHE_TTL) {
    subtreeCache.delete(key)
    return null
  }
  subtreeCache.delete(key)
  entry.timestamp = Date.now()
  subtreeCache.set(key, entry)
  return {
    payload: cloneForCache(entry.payload),
    meta: cloneForCache(entry.meta)
  }
}

function buildDatasetLabel(datum = {}) {
  const person = datum.data || {}
  const first = safeTrim(person['first name'])
  const last = safeTrim(person['last name'])
  const base = (first || last) ? [first, last].filter(Boolean).join(' ').trim() : (datum.id ? `Profil ${datum.id}` : 'Profil sans nom')
  const birth = safeTrim(person['birthday'])
  return birth ? `${base} (${birth})` : base
}

function createDatasetSearchOption(datum) {
  if (!datum || typeof datum.id !== 'string' || !datum.id.trim()) return null
  const label = buildDatasetLabel(datum)
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
    if (!trimmed) return
    if (metaSeen.has(trimmed)) return
    metaSeen.add(trimmed)
    metaParts.push(trimmed)
  }

  addToken(label)
  addToken(String(datum.id))

  const data = datum.data && typeof datum.data === 'object' ? datum.data : {}
  Object.entries(data).forEach(([rawKey, rawValue]) => {
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
      const meta = metaParts.length ? `<small>${metaParts.join(' · ')}</small>` : ''
      return `<div>${option.label_html || option.label}${meta ? `<div class="f3-autocomplete-meta">${meta}</div>` : ''}</div>`
    }
  }
}

function buildSearchOptionsFromDataset(persons) {
  if (!Array.isArray(persons)) return []
  const options = []
  const seen = new Set()
  persons.forEach(datum => {
    if (!datum || !datum.id || seen.has(datum.id)) return
    const option = createDatasetSearchOption(datum)
    if (!option) return
    options.push(option)
    seen.add(datum.id)
  })
  options.sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))
  return options
}

function setViewerSearchState(state) {
  if (!searchRoot) return
  if (!state) {
    delete searchRoot.dataset.state
  } else {
    searchRoot.dataset.state = String(state)
  }
  if (searchEmptyEl) {
    if (state === 'error') {
      searchEmptyEl.textContent = 'Impossible de charger la recherche pour le moment.'
    } else {
      searchEmptyEl.textContent = 'Aucune personne disponible pour le moment.'
    }
  }
}

const DETAIL_FIELD_ORDER = [
  'first name',
  'first names',
  'last name',
  'birthday',
  'death',
  'gender',
  'avatar',
  'bio'
]


const HIDDEN_FIELD_KEYS = new Set([
  'phone',
  'email',
  'notes',
  'occupation',
  'location',
  'residence',
  'nickname'
])

const FIELD_LABELS = {
  'first name': 'Prénom',
  'first names': 'Prénoms',
  'firstnames': 'Prénoms',
  'first_names': 'Prénoms',
  'last name': 'Nom',
  'nickname': 'Surnom',
  'maiden name': 'Nom de naissance',
  'birthday': 'Date de naissance',
  'death': 'Date de Décès',
  'gender': 'Genre',
  'location': 'Localisation',
  'birthplace': 'Lieu de naissance',
  'deathplace': 'Lieu de décès',
  'occupation': 'Profession',
  'bio': 'Biographie',
  'metiers': 'Métiers',
  'nationality': 'Nationalité',
  'notes': 'Notes',
  'email': 'Email',
  'phone': 'Téléphone',
  'avatar': 'Avatar'
}

const GENDER_LABELS = {
  'M': 'Masculin',
  'F': 'Féminin',
  'O': 'Autre',
  'X': 'Non binaire'
}

const DEFAULT_EMPTY_LABEL = 'Non renseigné'

const DEFAULT_CARD_DISPLAY = [
  ['first name', 'last name'],
  ['birthday']
]

const DEFAULT_CHART_CONFIG = Object.freeze({
  transitionTime: 200,
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
  cardDisplay: DEFAULT_CARD_DISPLAY.map(row => [...row]),
  mainId: null
  ,

  autoCenter: true
})

const PROGRESSIVE_DEPTH_STEP = 4
const PROGRESSIVE_MAX_STEPS = 12

let chartInstance = null
let cardInstance = null
let viewerConfig = { ...DEFAULT_CHART_CONFIG }
let totalPersons = 0
let isApplyingViewerConfig = false
let serverQueryState = {
  mainId: null,
  ancestryDepth: DEFAULT_CHART_CONFIG.ancestryDepth,
  progenyDepth: DEFAULT_CHART_CONFIG.progenyDepth,
  includeSiblings: true,
  includeSpouses: true
}
let lastSuccessfulQuery = null
let latestMeta = {
  total: 0,
  returned: 0,
  includeSiblings: true,
  includeSpouses: true
}
let activeFetchController = null
let searchSummaryPromise = null
let peopleSummary = null
let summarySearchOptions = []
let localSearchOptions = []
let searchOptions = []
let lastSelectionContext = { source: 'initial', label: null }
let peopleSummaryIndex = new Map()
let pendingMetaFrame = null
const lastMetaSnapshot = { visible: -1, branch: -1, total: -1 }
let lastStatusSnapshot = { message: '', type: '' }

function normalizeCardDisplay(rows) {
  const safeRows = Array.isArray(rows) ? rows : []
  const normalized = safeRows.slice(0, 2).map(row => sanitizeFieldValues(Array.isArray(row) ? row : []))
  while (normalized.length < 2) normalized.push([])
  return normalized
}

function normaliseTreePayload(payload) {
  if (Array.isArray(payload)) {
    return { data: payload, config: {}, meta: {} }
  }

  if (payload && typeof payload === 'object') {
    const meta = payload.meta && typeof payload.meta === 'object' ? payload.meta : {}
    if (Array.isArray(payload.data)) {
      const candidateConfig = payload.config || payload.settings || {}
      return { data: payload.data, config: candidateConfig, meta }
    }

    if (Array.isArray(payload.tree)) {
      const candidateConfig = payload.config || payload.settings || {}
      return { data: payload.tree, config: candidateConfig, meta }
    }
  }

  return { data: [], config: {}, meta: {} }
}

function stripOriginIfSame(rawUrl) {
  if (!rawUrl) return ''
  try {
    const parsed = new URL(rawUrl, window.location.origin)
    if (parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    }
    return parsed.toString()
  } catch (error) {
    return String(rawUrl)
  }
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

  const rawCardDisplay = rawConfig.cardDisplay ?? rawConfig.card_display
  if (Array.isArray(rawCardDisplay) || (rawCardDisplay && typeof rawCardDisplay === 'object')) {
    let source = rawCardDisplay
    if (rawCardDisplay && !Array.isArray(rawCardDisplay) && typeof rawCardDisplay === 'object') {
      source = [
        rawCardDisplay[0] ?? rawCardDisplay['0'] ?? rawCardDisplay.row1 ?? rawCardDisplay.row_1 ?? rawCardDisplay.ligne1 ?? rawCardDisplay.line1 ?? rawCardDisplay.first ?? [],
        rawCardDisplay[1] ?? rawCardDisplay['1'] ?? rawCardDisplay.row2 ?? rawCardDisplay.row_2 ?? rawCardDisplay.ligne2 ?? rawCardDisplay.line2 ?? rawCardDisplay.second ?? []
      ]
    }
    config.cardDisplay = normalizeCardDisplay(source)
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

  const rawLinkStyle = rawConfig.linkStyle ?? rawConfig.link_style
  if (rawLinkStyle === 'legacy' || rawLinkStyle === 'smooth') {
    config.linkStyle = rawLinkStyle
  }



  return config
}

function applyConfigToChart(chart, rawConfig) {
  const overrides = normaliseChartConfig(rawConfig)
  const config = { ...DEFAULT_CHART_CONFIG, ...overrides }

  const cardDisplayOverride = overrides.cardDisplay
  config.cardDisplay = (cardDisplayOverride && cardDisplayOverride.length)
    ? cardDisplayOverride.map(row => [...row])
    : DEFAULT_CARD_DISPLAY.map(row => [...row])

  chart.setTransitionTime(config.transitionTime)
  chart.setCardXSpacing(config.cardXSpacing)
  chart.setCardYSpacing(config.cardYSpacing)
  chart.setShowSiblingsOfMain(config.showSiblingsOfMain)
  if (chart && typeof chart.setLinkStyle === 'function') {
    chart.setLinkStyle(config.linkStyle || 'legacy')
  } else {
    console.warn('viewer: chart.setLinkStyle is not available; skipping link style configuration')
  }

  if (config.orientation === 'horizontal') {
    chart.setOrientationHorizontal()
  } else {
    chart.setOrientationVertical()
  }

  chart.setSingleParentEmptyCard(config.singleParentEmptyCard, {
    label: config.singleParentEmptyCardLabel
  })

  if (typeof config.ancestryDepth === 'number' && Number.isFinite(config.ancestryDepth)) {
    chart.setAncestryDepth(config.ancestryDepth)
  } else {
    chart.setAncestryDepth(null)
  }

  if (typeof config.progenyDepth === 'number' && Number.isFinite(config.progenyDepth)) {
    chart.setProgenyDepth(config.progenyDepth)
  } else {
    chart.setProgenyDepth(null)
  }



  return config
}

function serialiseDepthParam(value) {
  if (value === 'auto') return undefined
  if (value === 'all' || value === null) return 'all'
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return String(Math.floor(value))
  }
  return undefined
}

function buildSubtreeQuery(params) {
  const query = new URLSearchParams()
  query.set('mode', 'subtree')

  if (params.mainId && typeof params.mainId === 'string') {
    query.set('mainId', params.mainId)
  }

  const ancestryDepth = serialiseDepthParam(params.ancestryDepth)
  if (ancestryDepth !== undefined) {
    query.set('ancestryDepth', ancestryDepth)
  }

  const progenyDepth = serialiseDepthParam(params.progenyDepth)
  if (progenyDepth !== undefined) {
    query.set('progenyDepth', progenyDepth)
  }

  if (params.includeSiblings !== undefined) {
    query.set('includeSiblings', params.includeSiblings ? 'true' : 'false')
  }

  if (params.includeSpouses !== undefined) {
    query.set('includeSpouses', params.includeSpouses ? 'true' : 'false')
  }

  return query.toString()
}

function setInterfaceLoading(isLoading) {
  const loading = Boolean(isLoading)
  if (datasetMeta) datasetMeta.classList.toggle('is-loading', loading)
  if (searchContainer) searchContainer.classList.toggle('is-loading', loading)
}

function abortActiveFetch() {
  if (activeFetchController) {
    activeFetchController.abort()
    activeFetchController = null
  }
}

function normaliseMeta(meta, fallbackTotal = 0, fallbackReturned = fallbackTotal) {
  const payloadMeta = meta && typeof meta === 'object' ? meta : {}
  const total = Number.isFinite(payloadMeta.total) ? Math.max(0, Math.floor(payloadMeta.total)) : Math.max(0, Math.floor(fallbackTotal))
  const returned = Number.isFinite(payloadMeta.returned) ? Math.max(0, Math.floor(payloadMeta.returned)) : Math.max(0, Math.floor(fallbackReturned))
  const ancestryDepth = payloadMeta.ancestryDepth === null
    ? null
    : Number.isFinite(payloadMeta.ancestryDepth)
      ? Math.max(0, Math.floor(payloadMeta.ancestryDepth))
      : undefined
  const progenyDepth = payloadMeta.progenyDepth === null
    ? null
    : Number.isFinite(payloadMeta.progenyDepth)
      ? Math.max(0, Math.floor(payloadMeta.progenyDepth))
      : undefined

  return {
    total,
    returned,
    includeSiblings: payloadMeta.includeSiblings !== false,
    includeSpouses: payloadMeta.includeSpouses !== false,
    ancestryDepth,
    progenyDepth
  }
}

function hasQueryChanged(nextParams) {
  if (!lastSuccessfulQuery) return true
  const keys = ['mainId', 'ancestryDepth', 'progenyDepth', 'includeSiblings', 'includeSpouses']
  return keys.some(key => {
    const previous = lastSuccessfulQuery[key]
    const next = nextParams[key]
    if (previous === next) return false
    if (previous === null && next === undefined) return false
    if (previous === undefined && next === null) return false
    return true
  })
}

function buildSearchOption(person) {
  const label = typeof person.label === 'string' && person.label.trim() ? person.label.trim() : `Profil ${person.id}`
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
    if (!trimmed) return
    const key = trimmed.toLowerCase()
    if (metaSeen.has(key)) return
    metaSeen.add(key)
    metaParts.push(trimmed)
  }

  const registerField = (rawKey, rawValue) => {
    if (typeof rawValue !== 'string') return
    const trimmed = rawValue.trim()
    if (!trimmed) return

    const rkey = normalizeFieldKey(rawKey)
    if (HIDDEN_FIELD_KEYS.has(rkey)) return
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
    if (key === 'location' || key === 'residence' || key === 'birthplace' || key === 'deathplace') {
      addMeta(trimmed)
      return
    }
  }

  addToken(label)
  addToken(String(person.id || ''))

  if (typeof person.searchText === 'string' && person.searchText.trim()) {
    person.searchText.split('|').forEach(fragment => addToken(fragment))
  }

  registerField('birthday', person.birthday)
  registerField('death', person.death)
  registerField('location', person.location)
  registerField('residence', person.residence)
  registerField('maiden name', person.maidenName)

  if (person.fields && typeof person.fields === 'object') {
    Object.entries(person.fields).forEach(([fieldKey, fieldValue]) => {
      registerField(fieldKey, fieldValue)
    })
  }

  const normalisedTokens = Array.from(tokens)
    .map(value => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const searchText = normalisedTokens.length ? normalisedTokens.join(' | ') : label

  return {
    label,
    value: person.id,
    searchText,
    optionHtml: (option) => {
      const title = option.label_html || option.label
      const meta = metaParts.length ? `<small>${metaParts.join(' · ')}</small>` : ''
      return `<div>${title}${meta ? `<div class="f3-autocomplete-meta">${meta}</div>` : ''}</div>`
    }
  }
}

function buildSearchOptionsFromSummary(summary) {
  if (!summary || !Array.isArray(summary.persons)) return []
  const options = summary.persons
    .filter(person => person && typeof person.id === 'string')
    .map(person => buildSearchOption(person))
  options.sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))
  return options
}

function combineSearchOptions() {
  const merged = new Map()
  const mergeEntry = (option) => {
    if (!option || !option.value) return
    if (!merged.has(option.value)) {
      merged.set(option.value, { ...option })
      return
    }
    const existing = merged.get(option.value)
    const mergedSearchText = mergeSearchText(existing.searchText, option.searchText)
    if (mergedSearchText) {
      existing.searchText = mergedSearchText
    }
    if (typeof existing.optionHtml !== 'function' && typeof option.optionHtml === 'function') {
      existing.optionHtml = option.optionHtml
    }
  }

  const mergeSearchText = (first, second) => {
    const segments = new Set()
    const add = (value) => {
      if (typeof value !== 'string') return
      value.split('|').forEach(part => {
        const trimmed = part.trim()
        if (trimmed) segments.add(trimmed)
      })
    }
    add(first)
    add(second)
    if (!segments.size) return (first || second || '')
    return Array.from(segments).join(' | ')
  }

  localSearchOptions.forEach(mergeEntry)
  summarySearchOptions.forEach(mergeEntry)

  searchOptions = Array.from(merged.values())
  searchOptions.sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))
  if (chartInstance) {
    updateSearchOptionsForChart(chartInstance)
  }
}

function rebuildLocalSearchOptions(chart) {
  if (!chart || !chart.store || typeof chart.store.getData !== 'function') {
    localSearchOptions = []
    combineSearchOptions()
    return
  }

  try {
    const persons = chart.store.getData()
    localSearchOptions = buildSearchOptionsFromDataset(persons)
  } catch (error) {
    console.warn('[viewer] Impossible de reconstruire l’index local de recherche', error)
    localSearchOptions = []
  }

  combineSearchOptions()
}

function setSearchLoadingState(state) {
  setViewerSearchState(state)
  if (!searchContainer) return
  if (!state) {
    searchContainer.dataset.state = ''
  } else {
    searchContainer.dataset.state = String(state)
  }
}

async function ensurePeopleSummary(force = false) {
  if (!force && peopleSummary) return peopleSummary
  if (!force && searchSummaryPromise) return searchSummaryPromise

  setSearchLoadingState('loading')
  const controller = new AbortController()
  const promise = fetch('/api/tree/summary', { cache: 'no-store', signal: controller.signal })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response.json()
    })
    .then(summary => {
      peopleSummary = summary
      peopleSummaryIndex = new Map()
      if (Array.isArray(summary?.persons)) {
        summary.persons.forEach(person => {
          if (person && typeof person.id === 'string') {
            peopleSummaryIndex.set(person.id, person)
          }
        })
      }
      summarySearchOptions = buildSearchOptionsFromSummary(summary)
      setViewerSearchState(summarySearchOptions.length ? 'ready' : 'empty')
      combineSearchOptions()
      return peopleSummary
    })
    .catch(error => {
      if (error.name === 'AbortError') return peopleSummary
      console.error('Impossible de charger l\'index de recherche', error)
      setViewerSearchState('error')
      throw error
    })
    .finally(() => {
      if (searchSummaryPromise === promise) {
        searchSummaryPromise = null
      }
    })

  searchSummaryPromise = promise
  return promise
}

function updateSearchOptionsForChart(chart) {
  if (!chart || !chart.personSearch) return
  const options = Array.isArray(searchOptions) ? searchOptions : []
  chart.personSearch.setOptionsGetter(() => options)
  if (options.length) {
    setViewerSearchState('ready')
  } else if (peopleSummary) {
    setViewerSearchState('empty')
  }
}

function setStatus(message, type = 'info') {
  if (!statusEl) return
  if (lastStatusSnapshot.message === message && lastStatusSnapshot.type === type) {
    return
  }
  lastStatusSnapshot = { message, type }
  statusEl.textContent = message
  statusEl.dataset.status = type
}

function depthToSelectValue(value, fallback) {
  if (value === 'auto') return 'auto'
  if (value === 'all') return 'all'
  if (value === null) return 'all'
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return String(Math.floor(value))
  }
  if (typeof fallback === 'number' && Number.isFinite(fallback) && fallback >= 0) {
    return String(Math.floor(fallback))
  }
  if (fallback === 'auto') return 'auto'
  if (fallback === 'all' || fallback === null) return 'all'
  return 'auto'
}

function parseDepthSelectValue(select, fallback) {
  if (!select) return fallback
  const raw = select.value
  if (raw === 'auto') return 'auto'
  if (raw === 'all' || raw === '') return 'all'
  const value = Number(raw)
  if (Number.isFinite(value) && value >= 0) {
    return Math.floor(value)
  }
  return fallback
}

function updatePerformanceControlsUI(config) {
  if (ancestryDepthControl) ancestryDepthControl.value = depthToSelectValue(config.ancestryDepth, DEFAULT_CHART_CONFIG.ancestryDepth)
  if (progenyDepthControl) progenyDepthControl.value = depthToSelectValue(config.progenyDepth, DEFAULT_CHART_CONFIG.progenyDepth)
  if (miniTreeToggle) miniTreeToggle.checked = config.miniTree !== false
  if (autoCenterToggle) autoCenterToggle.checked = config.autoCenter !== false

}

function updateDatasetMeta() {
  if (pendingMetaFrame !== null) return
  const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 16)
  pendingMetaFrame = schedule(() => {
    pendingMetaFrame = null
    const visible = chartInstance?.store?.getTree?.()?.data?.length ?? 0


    let branchCount = Number.isFinite(latestMeta.returned) ? latestMeta.returned : undefined
    if (branchCount === undefined) {
      try {
        const storeData = chartInstance?.store?.getData?.()
        if (Array.isArray(storeData)) {
          const ids = new Set()
          storeData.forEach(p => { if (p && p.id) ids.add(p.id) })
          branchCount = ids.size
        }
      } catch (e) {
        branchCount = undefined
      }
    }
    if (!Number.isFinite(branchCount)) branchCount = visible

    if (lastMetaSnapshot.visible === visible && lastMetaSnapshot.branch === branchCount && lastMetaSnapshot.total === totalPersons) {
      return
    }

    lastMetaSnapshot.visible = visible
    lastMetaSnapshot.branch = branchCount
    lastMetaSnapshot.total = totalPersons

    if (visibleCountEl) visibleCountEl.textContent = String(visible)
    if (branchCountEl) branchCountEl.textContent = String(branchCount)
    if (totalCountEl) totalCountEl.textContent = String(totalPersons)
    if (datasetMeta) {
      datasetMeta.dataset.visible = String(visible)
      datasetMeta.dataset.total = String(totalPersons)
      datasetMeta.dataset.branch = String(branchCount)
    }
  })
}

function applyViewerConfig({ treePosition = 'inherit', initial = false } = {}) {
  if (!chartInstance) return
  if (typeof viewerConfig.ancestryDepth === 'number' && Number.isFinite(viewerConfig.ancestryDepth)) {
    chartInstance.setAncestryDepth(viewerConfig.ancestryDepth)
  } else {
    chartInstance.setAncestryDepth(null)
  }

  if (typeof viewerConfig.progenyDepth === 'number' && Number.isFinite(viewerConfig.progenyDepth)) {
    chartInstance.setProgenyDepth(viewerConfig.progenyDepth)
  } else {
    chartInstance.setProgenyDepth(null)
  }



  if (cardInstance && typeof cardInstance.setMiniTree === 'function') {
    cardInstance.setMiniTree(viewerConfig.miniTree !== false)
  }

  isApplyingViewerConfig = true
  updatePerformanceControlsUI(viewerConfig)
  isApplyingViewerConfig = false

  let nextPosition = 'inherit'
  if (treePosition === 'fit' || treePosition === 'main_to_middle') {
    nextPosition = treePosition
  }
  chartInstance.updateTree({ initial, tree_position: nextPosition })
  updateDatasetMeta()
}

function attachPerformanceHandlers() {
  ancestryDepthControl?.addEventListener('change', () => {
    if (isApplyingViewerConfig) return
    const fallback = viewerConfig.ancestryDepth ?? DEFAULT_CHART_CONFIG.ancestryDepth ?? null
    const value = parseDepthSelectValue(ancestryDepthControl, fallback)
    if (value === viewerConfig.ancestryDepth) return
    viewerConfig = { ...viewerConfig, ancestryDepth: value }
    requestSubtree({ ancestryDepth: value }, {
      reason: 'ancestry-depth-change',
      source: 'controls',
      reposition: false,
      treePosition: 'inherit',
      preservePreferences: true
    })
  })

  progenyDepthControl?.addEventListener('change', () => {
    if (isApplyingViewerConfig) return
    const fallback = viewerConfig.progenyDepth ?? DEFAULT_CHART_CONFIG.progenyDepth ?? null
    const value = parseDepthSelectValue(progenyDepthControl, fallback)
    if (value === viewerConfig.progenyDepth) return
    viewerConfig = { ...viewerConfig, progenyDepth: value }
    requestSubtree({ progenyDepth: value }, {
      reason: 'progeny-depth-change',
      source: 'controls',
      reposition: false,
      treePosition: 'inherit',
      preservePreferences: true
    })
  })

  miniTreeToggle?.addEventListener('change', () => {
    if (isApplyingViewerConfig) return
    const enabled = miniTreeToggle.checked
    const previous = viewerConfig.miniTree !== false
    if (enabled === previous) return
    viewerConfig = { ...viewerConfig, miniTree: enabled }
    applyViewerConfig({ treePosition: 'inherit' })
  })

  autoCenterToggle?.addEventListener('change', () => {
    if (isApplyingViewerConfig) return
    const enabled = autoCenterToggle.checked
    const previous = viewerConfig.autoCenter !== false
    if (enabled === previous) return
    viewerConfig = { ...viewerConfig, autoCenter: enabled }

    if (enabled && chartInstance) {
      chartInstance.updateTree({ tree_position: 'main_to_middle' })
    }

    setViewerPref('autoCenter', enabled)
  })


}

attachPerformanceHandlers()

function resolveLabelFromSummary(id) {
  if (!id || typeof id !== 'string') return null
  if (peopleSummaryIndex && peopleSummaryIndex.has(id)) {
    const entry = peopleSummaryIndex.get(id)
    if (entry && typeof entry.label === 'string' && entry.label.trim()) {
      return entry.label.trim()
    }
  }
  return null
}

function describeDepthValue(value) {
  if (value === 'auto') return 'auto (progressif)'
  if (value === 'all' || value === null) return 'sans limite'
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value === 0) return 'profil seul'
    return `${Math.floor(value)}`
  }
  return 'auto (progressif)'
}

function buildDepthSummary(config) {
  const ancestry = describeDepthValue(config.ancestryDepth)
  const progeny = describeDepthValue(config.progenyDepth)

  return `Profondeur — Ancêtres: ${ancestry}, Descendants: ${progeny}`
}

async function requestSubtree(partialParams = {}, context = {}) {
  const nextParams = {
    ...serverQueryState,
    ...partialParams
  }

  if (!hasQueryChanged(nextParams) && !context.force) {
    lastSelectionContext = {
      source: context.source || lastSelectionContext.source,
      label: context.selectedLabel || lastSelectionContext.label
    }
    return
  }

  serverQueryState = { ...nextParams }
  lastSelectionContext = {
    source: context.source || 'system',
    label: context.selectedLabel || resolveLabelFromSummary(nextParams.mainId) || lastSelectionContext.label
  }

  const loadingLabel = context.loadingLabel
    || (context.source === 'search' ? 'Recherche de la branche...' : 'Chargement de la branche...')

  setStatus(loadingLabel, 'loading')
  setInterfaceLoading(true)

  const controller = new AbortController()
  abortActiveFetch()
  activeFetchController = controller

  const wantsAutoAncestry = nextParams.ancestryDepth === 'auto' || nextParams.ancestryDepth === null
  const wantsAutoProgeny = nextParams.progenyDepth === 'auto' || nextParams.progenyDepth === null
  const shouldProgressiveLoad = !context.disableProgressive && (wantsAutoAncestry || wantsAutoProgeny)

  try {
    if (shouldProgressiveLoad) {
      await progressiveSubtreeRequest(nextParams, { ...context, controller })
    } else {
      await fetchSubtreeOnce(nextParams, { ...context, controller })
    }
  } finally {
    if (activeFetchController === controller) {
      activeFetchController = null
      setInterfaceLoading(false)
    }
  }
}

async function progressiveSubtreeRequest(initialParams, context = {}) {
  const controller = context.controller
  const wantsAutoAncestry = initialParams.ancestryDepth === 'auto' || initialParams.ancestryDepth === null
  const wantsAutoProgeny = initialParams.progenyDepth === 'auto' || initialParams.progenyDepth === null
  const stepInput = Number.isFinite(context.progressiveStep) && context.progressiveStep > 0
    ? Math.floor(context.progressiveStep)
    : PROGRESSIVE_DEPTH_STEP
  const stepSize = Math.max(1, stepInput)

  const currentParams = { ...initialParams }
  if (wantsAutoAncestry) {
    const fallback = Number.isFinite(DEFAULT_CHART_CONFIG.ancestryDepth)
      ? Math.max(0, DEFAULT_CHART_CONFIG.ancestryDepth)
      : stepSize
    currentParams.ancestryDepth = Math.max(stepSize, fallback)
  }

  if (wantsAutoProgeny) {
    const fallback = Number.isFinite(DEFAULT_CHART_CONFIG.progenyDepth)
      ? Math.max(0, DEFAULT_CHART_CONFIG.progenyDepth)
      : stepSize
    currentParams.progenyDepth = Math.max(stepSize, fallback)
  }

  const originalSnapshot = {
    ...initialParams,
    ancestryDepth: wantsAutoAncestry ? 'auto' : initialParams.ancestryDepth,
    progenyDepth: wantsAutoProgeny ? 'auto' : initialParams.progenyDepth
  }
  let iterations = 0
  let previousCount = chartInstance?.store?.getTree?.()?.data?.length ?? 0
  let encounteredError = false

  while (iterations < PROGRESSIVE_MAX_STEPS) {
    iterations += 1

    if (controller?.signal?.aborted) {
      return
    }

    if (wantsAutoAncestry || wantsAutoProgeny) {
      const summaryParts = []
      if (wantsAutoAncestry) summaryParts.push(`ancêtres ≤ ${currentParams.ancestryDepth}`)
      if (wantsAutoProgeny) summaryParts.push(`descendants ≤ ${currentParams.progenyDepth}`)
      if (summaryParts.length) {
        setStatus(`Chargement progressif (${summaryParts.join(', ')})...`, 'loading')
      }
    }

    const firstBatch = iterations === 1
    const batchTreePosition = firstBatch
      ? (context.treePosition !== undefined
        ? context.treePosition
        : (context.reposition === false
          ? 'inherit'
          : (context.source === 'search' ? 'main_to_middle' : 'inherit')))
      : 'inherit'

    const result = await fetchSubtreeOnce(currentParams, {
      ...context,
      controller,
      progressiveBatch: true,
      reposition: firstBatch ? context.reposition : false,
      treePosition: batchTreePosition
    })

    if (!result || result.aborted) {
      return
    }

    if (result.error) {
      encounteredError = true
      break
    }

    const meta = result.meta || {}
    const currentCount = chartInstance?.store?.getTree?.()?.data?.length ?? meta.returned ?? previousCount
    const gained = currentCount - previousCount
    previousCount = currentCount

    if (gained <= 0) {
      break
    }

    if (wantsAutoAncestry) {
      currentParams.ancestryDepth += stepSize
    }

    if (wantsAutoProgeny) {
      currentParams.progenyDepth += stepSize
    }
  }

  if (encounteredError) {
    return
  }

  lastSuccessfulQuery = { ...originalSnapshot }
  serverQueryState = {
    ...serverQueryState,
    ...originalSnapshot
  }

  if (viewerConfig) {
    viewerConfig = { ...viewerConfig }
    if (wantsAutoAncestry) viewerConfig.ancestryDepth = 'auto'
    if (wantsAutoProgeny) viewerConfig.progenyDepth = 'auto'
    isApplyingViewerConfig = true
    updatePerformanceControlsUI(viewerConfig)
    isApplyingViewerConfig = false
  }
}

async function fetchSubtreeOnce(params, context = {}) {
  const controller = context.controller || new AbortController()
  if (!context.controller) {
    abortActiveFetch()
  }

  const queryString = buildSubtreeQuery(params)
  const cacheKey = queryString

  if (!context.bypassCache && !context.disableCache) {
    const cached = getCachedSubtree(cacheKey)
    if (cached) {
      if (!context.controller) {
        activeFetchController = controller
      }
      lastSuccessfulQuery = { ...params }
      updateCacheSignature(cached.meta)
      applySubtreePayload(cached.payload, {
        ...context,
        params,
        fromCache: true
      })
      return { aborted: false, meta: cached.meta, fromCache: true }
    }
  }

  if (!context.controller) {
    activeFetchController = controller
  }

  try {
    const response = await fetch(`/api/tree?${queryString}`, { cache: 'no-store', signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = await response.json()
    if (controller.signal.aborted) {
      return { aborted: true }
    }

    const normalised = normaliseTreePayload(payload)
    const persons = Array.isArray(normalised.data) ? normalised.data : []
    const metaInfo = normaliseMeta(normalised.meta, persons.length)
    const cachePayload = {
      data: persons,
      config: normalised.config,
      meta: metaInfo
    }

    if (!persons.length && context.reason === 'initial' && !context.allowEmpty) {
      await fetchFullTree({
        ...context,
        preservePreferences: false,
        loadingLabel: 'Chargement complet de l\'arbre...',
        source: context.source || 'system'
      })
      return { aborted: false, meta: metaInfo }
    }

    lastSuccessfulQuery = { ...params }
    updateCacheSignature(metaInfo)
    if (!context.disableCache) {
      setSubtreeCache(cacheKey, cachePayload, metaInfo)
    }
    applySubtreePayload(cachePayload, {
      ...context,
      params
    })

    return { aborted: false, meta: metaInfo }
  } catch (error) {
    if (error.name === 'AbortError') {
      return { aborted: true, error }
    }
    console.error('Erreur de chargement de sous-arbre', error)
    setStatus(`Erreur: ${(error && error.message) || 'chargement interrompu'}`, 'error')
    return { aborted: false, error }
  }
}

function fetchFullTree(context = {}) {
  const loadingLabel = context.loadingLabel || 'Chargement complet de l\'arbre...'
  setStatus(loadingLabel, 'loading')
  setInterfaceLoading(true)
  clearSubtreeCache()

  return fetch('/api/tree', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response.json()
    })
    .then(payload => {
      const normalised = normaliseTreePayload(payload)
      const persons = Array.isArray(normalised.data) ? normalised.data : []
      const metaInfo = normaliseMeta(normalised.meta, persons.length)
      latestMeta = metaInfo
      totalPersons = metaInfo.total
      updateCacheSignature(metaInfo)

      const resolvedMainId = context.mainId
        || (typeof normalised.config?.mainId === 'string' ? normalised.config.mainId : null)
        || (persons[0]?.id ?? null)

      if (resolvedMainId) {
        serverQueryState = { ...serverQueryState, mainId: resolvedMainId }
      }

      const config = normaliseChartConfig(normalised.config)
      if (config.ancestryDepth !== undefined) {
        serverQueryState.ancestryDepth = config.ancestryDepth
      }
      if (config.progenyDepth !== undefined) {
        serverQueryState.progenyDepth = config.progenyDepth
      }

      lastSuccessfulQuery = null

      renderChart({
        data: persons,
        config: normalised.config,
        meta: metaInfo
      }, {
        preservePreferences: context.preservePreferences !== false,
        treePosition: context.treePosition || 'fit',
        source: context.source || 'system',
        selectedLabel: context.selectedLabel,
        mainId: resolvedMainId
      })
    })
    .catch(error => {
      console.error('Erreur lors du chargement complet de l\'arbre', error)
      setStatus(`Erreur: ${(error && error.message) || 'chargement impossible'}`, 'error')
    })
    .finally(() => {
      setInterfaceLoading(false)
    })
}

function applySubtreePayload(payload, context = {}) {
  const { data, config, meta } = normaliseTreePayload(payload)
  const persons = Array.isArray(data) ? data : []
  const metaInfo = normaliseMeta(meta, persons.length)
  latestMeta = metaInfo
  totalPersons = metaInfo.total
  updateCacheSignature(metaInfo)

  const requestedParams = context.params || {}
  const resolvedMainId = requestedParams.mainId
    || (typeof config?.mainId === 'string' ? config.mainId : null)
    || (persons[0]?.id ?? serverQueryState.mainId ?? null)

  serverQueryState = {
    ...serverQueryState,
    mainId: resolvedMainId,
    ancestryDepth: requestedParams.ancestryDepth ?? serverQueryState.ancestryDepth,
    progenyDepth: requestedParams.progenyDepth ?? serverQueryState.progenyDepth,
    includeSiblings: requestedParams.includeSiblings ?? serverQueryState.includeSiblings,
    includeSpouses: requestedParams.includeSpouses ?? serverQueryState.includeSpouses
  }

  const selectedLabel = context.selectedLabel || resolveLabelFromSummary(resolvedMainId)
  const treePosition = context.treePosition !== undefined
    ? context.treePosition
    : (context.reposition === false
      ? 'inherit'
      : (context.source === 'search' ? 'main_to_middle' : 'inherit'))
  renderChart({ data: persons, config, meta: metaInfo }, {
    preservePreferences: context.preservePreferences !== false,
    treePosition,
    source: context.source || lastSelectionContext.source,
    selectedLabel,
    mainId: resolvedMainId
  })
}

function resetDetails() {
  if (!detailsPanel || !emptyState || !detailsList) return
  if (detailsSummary) {
    detailsSummary.textContent = ''
    detailsSummary.classList.add('hidden')
  }
  emptyState.textContent = 'Sélectionnez une personne pour afficher les informations.'
  emptyState.classList.remove('hidden')
  clearElement(detailsList)
  updateDatasetMeta()
}

function buildFullName(person = {}) {
  const nameParts = [person['first name'], person['last name']].filter(Boolean)
  return nameParts.join(' ').trim()
}

function hasContent(value) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

function buildDetailEntries(person = {}) {
  const normalizedPerson = person || {}


  function findValueForKey(rawKey) {
    const desired = normalizeFieldKey(rawKey)
    const desiredCanonical = canonicalFieldKey(rawKey)

    if (Object.prototype.hasOwnProperty.call(normalizedPerson, rawKey)) {
      return normalizedPerson[rawKey]
    }

    for (const k of Object.keys(normalizedPerson)) {
      if (normalizeFieldKey(k) === desired) return normalizedPerson[k]
    }

    for (const k of Object.keys(normalizedPerson)) {
      if (canonicalFieldKey(k) === desiredCanonical) return normalizedPerson[k]
    }
    return undefined
  }


  const entries = DETAIL_FIELD_ORDER.map(field => ({
    field,
    value: findValueForKey(field),
    mandatory: true
  }))


  const seen = new Set(DETAIL_FIELD_ORDER.map(canonicalFieldKey))

  Object.entries(normalizedPerson).forEach(([field, value]) => {
    if (isUnionReferenceKey(field)) return
    const key = canonicalFieldKey(field)

    if (HIDDEN_FIELD_KEYS.has(key)) return
    if (seen.has(key)) return
    if (!hasContent(value)) return
    seen.add(key)
    entries.push({ field, value, mandatory: false })
  })

  return entries
}

function isUnionReferenceKey(field) {
  if (typeof field !== 'string') return false
  return field.startsWith('union date__ref__') || field.startsWith('union place__ref__')
}

function collectSpouseUnionDetails(datum) {
  if (!datum || !datum.data) return []
  const personData = datum.data || {}
  const candidateIds = new Set()

  const spouseIds = Array.isArray(datum.rels?.spouses) ? datum.rels.spouses : []
  spouseIds.forEach(id => {
    if (id) candidateIds.add(id)
  })

  Object.keys(personData).forEach(key => {
    if (!isUnionReferenceKey(key)) return
    const [, refId] = key.split('__ref__')
    if (refId) candidateIds.add(refId)
  })

  const details = []
  candidateIds.forEach(id => {
    if (!id) return
    const unionDate = safeTrim(personData[`union date__ref__${id}`])
    const unionPlace = safeTrim(personData[`union place__ref__${id}`])
    const storeDatum = chartInstance?.store?.getDatum?.(id)
    const hasUnionInfo = Boolean(unionDate || unionPlace)
    if (!storeDatum && !hasUnionInfo) {
      return
    }


    let name = `Profil ${id}`
    if (storeDatum) {
      const pd = storeDatum.data || {}
      const f = safeTrim(pd['first name'])
      const l = safeTrim(pd['last name'])
      name = (f || l) ? [f, l].filter(Boolean).join(' ').trim() : (storeDatum.id ? `Profil ${storeDatum.id}` : `Profil ${id}`)
    }
    details.push({
      id,
      name,
      unionDate,
      unionPlace
    })
  })

  return details
}

function renderUnionDetails(datum) {
  if (!detailsList) return 0
  const unions = collectSpouseUnionDetails(datum)
  if (!unions.length) return 0

  const item = document.createElement('article')
  item.className = 'detail-item detail-unions'

  const labelEl = document.createElement('span')
  labelEl.className = 'detail-label'
  labelEl.textContent = unions.length > 1 ? 'Unions' : 'Union'
  item.append(labelEl)

  const valueEl = document.createElement('div')
  valueEl.className = 'detail-value union-list'

  unions.forEach(detail => {
    const entryEl = document.createElement('div')
    entryEl.className = 'union-entry'

    const nameEl = document.createElement('p')
    nameEl.className = 'union-name'
    nameEl.textContent = detail.name
    entryEl.append(nameEl)

    entryEl.append(createUnionRow("Date d'union", detail.unionDate))
    entryEl.append(createUnionRow("Lieu d'union", detail.unionPlace))

    valueEl.append(entryEl)
  })

  item.append(valueEl)
  detailsList.append(item)
  return unions.length
}

function createUnionRow(label, value) {
  const row = document.createElement('p')
  row.className = 'union-row'

  const labelSpan = document.createElement('span')
  labelSpan.className = 'union-row-label'
  labelSpan.textContent = `${label} :`

  const valueSpan = document.createElement('span')
  valueSpan.className = 'union-row-value'
  if (!value) {
    valueSpan.classList.add('empty')
    valueSpan.textContent = DEFAULT_EMPTY_LABEL
  } else {
    valueSpan.textContent = value
  }

  row.append(labelSpan, valueSpan)
  return row
}

function formatFieldLabel(rawField) {
  if (!rawField) return ''
  const field = rawField.toLowerCase()
  if (FIELD_LABELS[field]) return FIELD_LABELS[field]
  return field.replace(/\b\w/g, char => char.toUpperCase())
}

function formatArrayValue(value) {
  return value
    .map(item => {
      if (typeof item === 'string') return item.trim()
      if (typeof item === 'object' && item !== null) return JSON.stringify(item)
      return String(item)
    })
    .filter(Boolean)
    .join(', ')
}

function resolveFieldDisplay(field, rawValue) {
  if (rawValue === undefined) {
    return { text: DEFAULT_EMPTY_LABEL, empty: true }
  }

  if (field === 'avatar') {
    const url = (rawValue || '').toString().trim()
    if (!url) return { text: DEFAULT_EMPTY_LABEL, empty: true }
    return { type: 'avatar', url }
  }

  if (field === 'gender' && typeof rawValue === 'string') {
    const transformed = GENDER_LABELS[rawValue.toUpperCase()] || rawValue
    return { text: transformed }
  }

  if (rawValue === null) {
    return { text: DEFAULT_EMPTY_LABEL, empty: true }
  }

  if (Array.isArray(rawValue)) {
    if (!rawValue.length) return { text: DEFAULT_EMPTY_LABEL, empty: true }
    return { text: formatArrayValue(rawValue) }
  }

  if (typeof rawValue === 'object') {
    const json = JSON.stringify(rawValue, null, 2)
    if (!json) return { text: DEFAULT_EMPTY_LABEL, empty: true }
    return { text: json, pre: true }
  }

  const value = String(rawValue).trim()
  if (!value) return { text: DEFAULT_EMPTY_LABEL, empty: true }

  const isLongText = value.includes('\n') || value.length > 80
  return { text: value, pre: isLongText }
}

function createDetailItem(field, display) {
  if (!detailsList) return
  const item = document.createElement('article')
  item.className = 'detail-item'

  const labelEl = document.createElement('span')
  labelEl.className = 'detail-label'
  labelEl.textContent = formatFieldLabel(field)
  item.append(labelEl)

  if (display.type === 'avatar') {
    const valueEl = document.createElement('div')
    valueEl.className = 'avatar-preview'

    const img = document.createElement('img')
    img.src = display.url
    img.alt = `Avatar de ${detailsSummary?.textContent || 'la personne sélectionnée'}`
    img.loading = 'lazy'

    const link = document.createElement('a')
    link.href = display.url
    link.target = '_blank'
    link.rel = 'noopener'
    link.textContent = 'Ouvrir l’image'

    valueEl.append(img, link)
    item.append(valueEl)
    detailsList.append(item)
    return
  }

  const valueEl = document.createElement('div')
  valueEl.className = 'detail-value'
  if (display.pre) valueEl.classList.add('preformatted')
  if (display.empty) valueEl.classList.add('empty')
  valueEl.textContent = display.text
  item.append(valueEl)
  detailsList.append(item)
}

function showDetailsForDatum(datum) {
  if (!detailsPanel || !detailsList || !emptyState) return
  const person = datum?.data || {}

  clearElement(detailsList)

  const fullName = buildFullName(person)
  const highlight = []
  if (person['birthday']) highlight.push(`Né(e) : ${person['birthday']}`)
  if (person['death']) highlight.push(`Décès : ${person['death']}`)

  if (detailsSummary) {
    if (fullName) {
      detailsSummary.textContent = highlight.length ? `${fullName} · ${highlight.join(' · ')}` : fullName
      detailsSummary.classList.remove('hidden')
    } else if (highlight.length) {
      detailsSummary.textContent = highlight.join(' · ')
      detailsSummary.classList.remove('hidden')
    } else {
      detailsSummary.textContent = ''
      detailsSummary.classList.add('hidden')
    }
  }

  const entries = buildDetailEntries(person)
  let rendered = 0
  entries.forEach(entry => {
    const display = resolveFieldDisplay(entry.field, entry.value)
    if (display.empty) return
    createDetailItem(entry.field, display)
    rendered += 1
  })

  rendered += renderUnionDetails(datum)

  if (rendered === 0) {
    emptyState.textContent = 'Aucune information supplémentaire disponible.'
    emptyState.classList.remove('hidden')
  } else {
    emptyState.classList.add('hidden')
  }

}

function handlePersonSelection(datum, source = 'card') {
  if (!datum) return

  const name = buildFullName(datum.data || {}) || `Profil ${datum.id}`
  showDetailsForDatum(datum)

  if (chartInstance) {
    chartInstance.updateMainId(datum.id)

    applyViewerConfig({ treePosition: 'inherit', initial: false })
  }

  const prefixLabel = source === 'search' ? 'Resultat' : 'Selection'
  setStatus(`${prefixLabel} : ${name}`, 'info')

  if (source === 'search') {
    const input = searchContainer?.querySelector('input')
    if (input) {
      input.value = ''
      input.blur()
    }
  }

  const desiredTreePosition = viewerConfig && viewerConfig.autoCenter !== false ? 'main_to_middle' : (source === 'search' ? 'main_to_middle' : 'inherit')
  requestSubtree({ mainId: datum.id }, {
    source,
    treePosition: desiredTreePosition,
    reposition: source === 'search' || (viewerConfig && viewerConfig.autoCenter !== false),
    preservePreferences: true,
    selectedLabel: name,
    loadingLabel: `${source === 'search' ? 'Recherche' : 'Selection'} : ${name}...`
  })
}

function setupSearch(chart) {
  if (!searchContainer) return

  clearElement(searchContainer)
  const initialState = searchOptions && searchOptions.length
    ? 'ready'
    : (peopleSummary && peopleSummary.length === 0 ? 'empty' : 'loading')
  setViewerSearchState(initialState)

  chart.setPersonDropdown(datum => {
    const person = datum.data || {}
    const name = buildFullName(person) || 'Profil sans nom'
    const extras = []
    if (person['birthday']) extras.push(person['birthday'])
    if (person['death']) extras.push(`✝ ${person['death']}`)
    return extras.length ? `${name} (${extras.join(' · ')})` : name
  }, {
    cont: searchContainer,
    placeholder: 'Rechercher (nom, date, lieu, etc.)',
    onSelect: (id) => {
      const selected = chart.store?.getDatum?.(id)
      if (selected) {
        handlePersonSelection(selected, 'search')
        return
      }
      const fallbackLabel = resolveLabelFromSummary(id) || `Profil ${id}`
      requestSubtree({ mainId: id }, {
        source: 'search',
        treePosition: 'main_to_middle',
        reposition: true,
        preservePreferences: true,
        selectedLabel: fallbackLabel,
        loadingLabel: `Recherche : ${fallbackLabel}...`
      })
    }
  })

  const itemsContainer = searchContainer.querySelector('.f3-autocomplete-items')
  if (itemsContainer) {
    const toggleItemsState = () => {
      const hasChildren = itemsContainer.childElementCount > 0
      itemsContainer.classList.toggle('is-empty', !hasChildren)
      if (hasChildren) {
        itemsContainer.tabIndex = 0
      } else {
        itemsContainer.removeAttribute('tabindex')
      }
    }

    toggleItemsState()
    const observer = new MutationObserver(toggleItemsState)
    observer.observe(itemsContainer, { childList: true })
  }

  const searchInput = searchContainer.querySelector('input')
  if (searchInput) {
    searchInput.id = 'personSearchInput'
    searchInput.setAttribute('placeholder', 'Rechercher (nom, date, lieu, etc.)')
    if (searchHint && searchHint.id) {
      searchInput.setAttribute('aria-describedby', searchHint.id)
    }
  }

  updateSearchOptionsForChart(chart)
  ensurePeopleSummary().then(() => {
    updateSearchOptionsForChart(chart)
  }).catch(() => { })
}

function renderChart(payload, options = {}) {
  const container = document.querySelector(chartSelector)
  if (!container) {
    throw new Error('Conteneur du graphique introuvable')
  }

  const normalised = payload && payload.data !== undefined
    ? payload
    : normaliseTreePayload(payload)

  const dataArray = Array.isArray(normalised.data) ? normalised.data : []

  try {
    const imageKeys = ['avatar', 'photo', 'picture']
    dataArray.forEach(datum => {
      if (!datum || !datum.data) return
      imageKeys.forEach(key => {
        try {
          const val = datum.data[key]
          if (!val) return
          datum.data[key] = stripOriginIfSame(val)
        } catch (e) {
        }
      })
    })
  } catch (error) {
  }
  const rawConfig = normalised.config || {}
  const isInitialRender = !chartInstance

  if (isInitialRender) {
    clearElement(container)
  }

  resetDetails()

  if (!chartInstance) {
    chartInstance = f3.createChart(chartSelector, dataArray)
  } else {
    chartInstance.updateData(dataArray)
  }

  const chart = chartInstance
  const baseConfig = applyConfigToChart(chart, rawConfig)

  const mergedConfig = {
    ...baseConfig,
    mainId: options.mainId || baseConfig.mainId || viewerConfig.mainId || null,
    ancestryDepth: serverQueryState.ancestryDepth,
    progenyDepth: serverQueryState.progenyDepth,

    miniTree: options.preservePreferences && viewerConfig ? viewerConfig.miniTree !== false : baseConfig.miniTree !== false,
    cardDisplay: baseConfig.cardDisplay && baseConfig.cardDisplay.length
      ? baseConfig.cardDisplay.map(row => [...row])
      : DEFAULT_CARD_DISPLAY.map(row => [...row])
  }

  if (options.preservePreferences && viewerConfig) {
    mergedConfig.cardDisplay = viewerConfig.cardDisplay && viewerConfig.cardDisplay.length
      ? viewerConfig.cardDisplay.map(row => [...row])
      : mergedConfig.cardDisplay
    mergedConfig.transitionTime = viewerConfig.transitionTime ?? mergedConfig.transitionTime
    mergedConfig.cardXSpacing = viewerConfig.cardXSpacing ?? mergedConfig.cardXSpacing
    mergedConfig.cardYSpacing = viewerConfig.cardYSpacing ?? mergedConfig.cardYSpacing
    mergedConfig.singleParentEmptyCard = viewerConfig.singleParentEmptyCard ?? mergedConfig.singleParentEmptyCard
    mergedConfig.singleParentEmptyCardLabel = viewerConfig.singleParentEmptyCardLabel ?? mergedConfig.singleParentEmptyCardLabel
    mergedConfig.orientation = viewerConfig.orientation ?? mergedConfig.orientation
  }

  viewerConfig = { ...mergedConfig }
  viewerConfig.mainId = mergedConfig.mainId


  const persistedAutoCenter = getViewerPref('autoCenter', viewerConfig.autoCenter)
  viewerConfig.autoCenter = persistedAutoCenter === undefined ? viewerConfig.autoCenter : persistedAutoCenter

  const cardDisplayConfig = viewerConfig.cardDisplay && viewerConfig.cardDisplay.length
    ? viewerConfig.cardDisplay.map(row => [...row])
    : DEFAULT_CARD_DISPLAY.map(row => [...row])

  if (!cardInstance) {
    cardInstance = chart.setCardHtml()
  }

  if (typeof cardInstance.setCardDisplay === 'function') {
    cardInstance.setCardDisplay(cardDisplayConfig)
  }
  if (typeof cardInstance.setMiniTree === 'function') {
    cardInstance.setMiniTree(viewerConfig.miniTree !== false)
  }

  if (typeof cardInstance.setOnCardClick === 'function') {
    cardInstance.setOnCardClick((event, treeDatum) => {
      const id = treeDatum?.data?.id
      if (!id) return
      const datum = chart.store?.getDatum?.(id)
      if (datum) {
        handlePersonSelection(datum, 'card')
      } else {
        const fallbackLabel = resolveLabelFromSummary(id) || `Profil ${id}`
        requestSubtree({ mainId: id }, {
          source: 'card',
          treePosition: 'inherit',
          reposition: false,
          preservePreferences: true,
          selectedLabel: fallbackLabel,
          loadingLabel: `Selection : ${fallbackLabel}...`
        })
      }
    })
  }

  if (typeof cardInstance.setOnMiniTreeClick === 'function') {
    cardInstance.setOnMiniTreeClick((event, treeDatum) => {
      const id = treeDatum?.data?.id
      if (!id) return
      const datum = chart.store?.getDatum?.(id)
      if (datum) {
        handlePersonSelection(datum, 'card')
      } else {
        const fallbackLabel = resolveLabelFromSummary(id) || `Profil ${id}`
        requestSubtree({ mainId: id }, {
          source: 'card',
          treePosition: 'inherit',
          reposition: false,
          preservePreferences: true,
          selectedLabel: fallbackLabel,
          loadingLabel: `Selection : ${fallbackLabel}...`
        })
      }
    })
  }



  isApplyingViewerConfig = true
  updatePerformanceControlsUI(viewerConfig)
  isApplyingViewerConfig = false

  if (viewerConfig.mainId) {
    chart.updateMainId(viewerConfig.mainId)
  }

  rebuildLocalSearchOptions(chart)

  if (isInitialRender) {
    setupSearch(chart)
  } else {
    updateSearchOptionsForChart(chart)
  }

  const initialUpdate = options.preservePreferences === false
  const requestedTreePosition = options.treePosition
  const defaultTreePosition = requestedTreePosition
    || (options.source === 'search'
      ? 'main_to_middle'
      : (isInitialRender ? 'fit' : 'inherit'))

  applyViewerConfig({ treePosition: defaultTreePosition, initial: initialUpdate })

  const mainDatum = chart.getMainDatum?.()
  const effectiveMainId = chart.store?.getMainId?.() || viewerConfig.mainId
  if (effectiveMainId && effectiveMainId !== viewerConfig.mainId) {
    viewerConfig.mainId = effectiveMainId
  }
  if (effectiveMainId) {
    serverQueryState.mainId = effectiveMainId
    if (lastSuccessfulQuery) {
      lastSuccessfulQuery = { ...lastSuccessfulQuery, mainId: effectiveMainId }
    }
  }
  if (mainDatum) {
    showDetailsForDatum(mainDatum)
  }

  updateDatasetMeta()


  let branchCount = Number.isFinite(latestMeta.returned) ? latestMeta.returned : undefined
  if (!Number.isFinite(branchCount)) {
    try {
      if (Array.isArray(dataArray)) {
        const ids = new Set()
        dataArray.forEach(p => { if (p && p.id) ids.add(p.id) })
        branchCount = ids.size
      }
    } catch (e) {
      branchCount = undefined
    }
  }
  if (!Number.isFinite(branchCount)) branchCount = dataArray.length

  const totalCount = Number.isFinite(latestMeta.total) ? latestMeta.total : dataArray.length
  const name = mainDatum
    ? (buildFullName(mainDatum.data || {}) || `Profil ${mainDatum.id}`)
    : (options.selectedLabel || 'Branche courante')
  const prefix = options.source === 'search'
    ? 'Résultat'
    : options.source === 'card'
      ? 'Sélection'
      : 'Branche'
  const branchLabel = branchCount === 1 ? 'profil' : 'profils'
  const totalLabel = totalCount === 1 ? 'profil' : 'profils'

  setStatus(`${prefix} : ${name} — ${branchCount} ${branchLabel} dans la branche / ${totalCount} ${totalLabel} au total`, 'success')

  lastSelectionContext = { source: options.source || prefix.toLowerCase(), label: name }

  ensurePeopleSummary().then(() => {
    updateSearchOptionsForChart(chart)
  }).catch(() => { })
}

fetchFullTree({ preservePreferences: false, source: 'system' }).catch(() => {
  setStatus('Impossible de charger les données', 'error')
})
