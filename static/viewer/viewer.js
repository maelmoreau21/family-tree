import * as f3 from '/lib/family-tree.esm.js'

const statusEl = document.getElementById('status')
const detailsPanel = document.getElementById('personDetails')
const searchContainer = document.getElementById('personSearch')
const detailsList = detailsPanel?.querySelector('.detail-list')
const detailsSummary = detailsPanel?.querySelector('.summary')
const emptyState = detailsPanel?.querySelector('.empty')
const chartSelector = '#FamilyChart'
const ancestryDepthControl = document.getElementById('viewerAncestryDepth')
const progenyDepthControl = document.getElementById('viewerProgenyDepth')
const miniTreeToggle = document.getElementById('viewerMiniTree')
const duplicateToggle = document.getElementById('viewerDuplicateToggle')
const datasetMeta = document.querySelector('[data-role="dataset-meta"]')
const visibleCountEl = document.querySelector('[data-role="visible-count"]')
const branchCountEl = document.querySelector('[data-role="branch-count"]')
const totalCountEl = document.querySelector('[data-role="total-count"]')

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

const DETAIL_FIELD_ORDER = [
  'first name',
  'last name',
  'birthday',
  'death',
  'gender',
  'avatar',
  'bio'
]

const FIELD_LABELS = {
  'first name': 'Prénom',
  'last name': 'Nom',
  'nickname': 'Surnom',
  'maiden name': 'Nom de jeune fille',
  'birthday': 'Date de naissance',
  'death': 'Date de Décès',
  'gender': 'Genre',
  'location': 'Localisation',
  'birthplace': 'Lieu de naissance',
  'deathplace': 'Lieu de décès',
  'occupation': 'Profession',
  'bio': 'Biographie',
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
  cardXSpacing: 200,
  cardYSpacing: 140,
  orientation: 'vertical',
  showSiblingsOfMain: true,
  singleParentEmptyCard: true,
  singleParentEmptyCardLabel: 'Inconnu',
  ancestryDepth: 4,
  progenyDepth: 4,
  miniTree: true,
  duplicateBranchToggle: true,
  cardDisplay: DEFAULT_CARD_DISPLAY.map(row => [...row]),
  mainId: null
})

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
let searchOptions = []
let lastSelectionContext = { source: 'initial', label: null }
let peopleSummaryIndex = new Map()

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

  const rawDuplicateToggle = rawConfig.duplicateBranchToggle ?? rawConfig.duplicate_branch_toggle
  if (typeof rawDuplicateToggle === 'boolean') {
    config.duplicateBranchToggle = rawDuplicateToggle
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

  chart.setDuplicateBranchToggle(config.duplicateBranchToggle !== false)

  return config
}

function serialiseDepthParam(value) {
  if (value === null) return 'all'
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
  const metaParts = []
  if (typeof person.birthday === 'string' && person.birthday.trim()) metaParts.push(person.birthday.trim())
  if (typeof person.death === 'string' && person.death.trim()) metaParts.push(`✝ ${person.death.trim()}`)
  if (typeof person.location === 'string' && person.location.trim()) metaParts.push(person.location.trim())

  return {
    label,
    value: person.id,
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

function setSearchLoadingState(state) {
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
      searchOptions = buildSearchOptionsFromSummary(summary)
      setSearchLoadingState('ready')
      return peopleSummary
    })
    .catch(error => {
      if (error.name === 'AbortError') return peopleSummary
      console.error('Impossible de charger l\'index de recherche', error)
      setSearchLoadingState('error')
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
  if (!searchOptions || !searchOptions.length) return
  chart.personSearch.setOptionsGetter(() => searchOptions)
}

function setStatus(message, type = 'info') {
  if (!statusEl) return
  statusEl.textContent = message
  statusEl.dataset.status = type
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

function updatePerformanceControlsUI(config) {
  if (ancestryDepthControl) ancestryDepthControl.value = depthToSelectValue(config.ancestryDepth, DEFAULT_CHART_CONFIG.ancestryDepth)
  if (progenyDepthControl) progenyDepthControl.value = depthToSelectValue(config.progenyDepth, DEFAULT_CHART_CONFIG.progenyDepth)
  if (miniTreeToggle) miniTreeToggle.checked = config.miniTree !== false
  if (duplicateToggle) duplicateToggle.checked = config.duplicateBranchToggle !== false
}

function updateDatasetMeta() {
  const visible = chartInstance?.store?.getTree?.()?.data?.length ?? 0
  const branchCount = Number.isFinite(latestMeta.returned) ? latestMeta.returned : visible
  if (visibleCountEl) visibleCountEl.textContent = String(visible)
  if (branchCountEl) branchCountEl.textContent = String(branchCount)
  if (totalCountEl) totalCountEl.textContent = String(totalPersons)
  if (datasetMeta) {
    datasetMeta.dataset.visible = String(visible)
    datasetMeta.dataset.total = String(totalPersons)
    datasetMeta.dataset.branch = String(branchCount)
  }
}

function applyViewerConfig({ reposition = false, initial = false } = {}) {
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

  chartInstance.setDuplicateBranchToggle(viewerConfig.duplicateBranchToggle !== false)

  if (cardInstance && typeof cardInstance.setMiniTree === 'function') {
    cardInstance.setMiniTree(viewerConfig.miniTree !== false)
  }

  isApplyingViewerConfig = true
  updatePerformanceControlsUI(viewerConfig)
  isApplyingViewerConfig = false

  chartInstance.updateTree({ initial, tree_position: reposition ? 'main_to_middle' : 'inherit' })
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
      reposition: true,
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
      reposition: true,
      preservePreferences: true
    })
  })

  miniTreeToggle?.addEventListener('change', () => {
    if (isApplyingViewerConfig) return
    const enabled = miniTreeToggle.checked
    const previous = viewerConfig.miniTree !== false
    if (enabled === previous) return
    viewerConfig = { ...viewerConfig, miniTree: enabled }
    applyViewerConfig({ reposition: false })
  })

  duplicateToggle?.addEventListener('change', () => {
    if (isApplyingViewerConfig) return
    const enabled = duplicateToggle.checked
    const previous = viewerConfig.duplicateBranchToggle !== false
    if (enabled === previous) return
    viewerConfig = { ...viewerConfig, duplicateBranchToggle: enabled }
    applyViewerConfig({ reposition: false })
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
  if (value === null) return 'sans limite'
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value === 0) return 'profil seul'
    return `${Math.floor(value)}`
  }
  return 'auto'
}

function buildDepthSummary(config) {
  const ancestry = describeDepthValue(config.ancestryDepth)
  const progeny = describeDepthValue(config.progenyDepth)
  return `Ancetres: ${ancestry}, Descendants: ${progeny}`
}

function requestSubtree(partialParams = {}, context = {}) {
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

  const queryString = buildSubtreeQuery(nextParams)

  fetch(`/api/tree?${queryString}`, { cache: 'no-store', signal: controller.signal })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response.json()
    })
    .then(payload => {
      if (controller.signal.aborted) return
      const normalised = normaliseTreePayload(payload)
      const persons = Array.isArray(normalised.data) ? normalised.data : []
      const metaInfo = normaliseMeta(normalised.meta, persons.length)

      if (!persons.length && context.reason === 'initial' && !context.allowEmpty) {
        fetchFullTree({
          ...context,
          preservePreferences: false,
          loadingLabel: 'Chargement complet de l\'arbre...',
          source: context.source || 'system'
        })
        return
      }

      lastSuccessfulQuery = { ...nextParams }
      applySubtreePayload({
        data: persons,
        config: normalised.config,
        meta: metaInfo
      }, {
        ...context,
        params: nextParams
      })
    })
    .catch(error => {
      if (error.name === 'AbortError') return
      console.error('Erreur de chargement de sous-arbre', error)
      setStatus(`Erreur: ${(error && error.message) || 'chargement interrompu'}`, 'error')
    })
    .finally(() => {
      if (activeFetchController === controller) {
        activeFetchController = null
        setInterfaceLoading(false)
      }
    })
}

function fetchFullTree(context = {}) {
  const loadingLabel = context.loadingLabel || 'Chargement complet de l\'arbre...'
  setStatus(loadingLabel, 'loading')
  setInterfaceLoading(true)

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

      const resolvedMainId = context.mainId
        || (typeof normalised.config?.mainId === 'string' ? normalised.config.mainId : null)
        || (persons[0]?.id ?? null)

      if (resolvedMainId) {
        serverQueryState = { ...serverQueryState, mainId: resolvedMainId }
      }

      lastSuccessfulQuery = null

      renderChart({
        data: persons,
        config: normalised.config,
        meta: metaInfo
      }, {
        preservePreferences: context.preservePreferences !== false,
        reposition: true,
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
  renderChart({ data: persons, config, meta: metaInfo }, {
    preservePreferences: context.preservePreferences !== false,
    reposition: context.reposition !== false,
    source: context.source || lastSelectionContext.source,
    selectedLabel,
    mainId: resolvedMainId
  })
}

function resetDetails() {
  if (!detailsPanel || !emptyState || !detailsList || !detailsSummary) return
  detailsSummary.textContent = ''
  detailsSummary.classList.add('hidden')
  emptyState.textContent = 'Sélectionnez une personne pour afficher les informations.'
  emptyState.classList.remove('hidden')
  detailsList.innerHTML = ''
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
  const entries = DETAIL_FIELD_ORDER.map(field => ({
    field,
    value: normalizedPerson[field],
    mandatory: true
  }))

  const seen = new Set(DETAIL_FIELD_ORDER)
  Object.entries(normalizedPerson).forEach(([field, value]) => {
    if (seen.has(field)) return
    if (!hasContent(value)) return
    entries.push({ field, value, mandatory: false })
  })

  return entries
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
  if (!detailsPanel || !detailsList || !emptyState || !detailsSummary) return
  const person = datum?.data || {}

  detailsList.innerHTML = ''

  const fullName = buildFullName(person)
  const highlight = []
  if (person['birthday']) highlight.push(`Né(e) : ${person['birthday']}`)
  if (person['death']) highlight.push(`Décès : ${person['death']}`)

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

  const entries = buildDetailEntries(person)
  let rendered = 0
  entries.forEach(entry => {
    const display = resolveFieldDisplay(entry.field, entry.value)
    if (display.empty) return
    createDetailItem(entry.field, display)
    rendered += 1
  })

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
    chartInstance.updateTree({ initial: false, tree_position: 'main_to_middle' })
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

  requestSubtree({ mainId: datum.id }, {
    source,
    reposition: true,
    preservePreferences: true,
    selectedLabel: name,
    loadingLabel: `${source === 'search' ? 'Recherche' : 'Selection'} : ${name}...`
  })
}

function setupSearch(chart) {
  if (!searchContainer) return

  searchContainer.innerHTML = ''

  chart.setPersonDropdown(datum => {
    const person = datum.data || {}
    const name = buildFullName(person) || 'Profil sans nom'
    const extras = []
    if (person['birthday']) extras.push(person['birthday'])
    if (person['death']) extras.push(`✝ ${person['death']}`)
    return extras.length ? `${name} (${extras.join(' · ')})` : name
  }, {
    cont: searchContainer,
  placeholder: 'Rechercher une personne...',
    onSelect: (id) => {
      const selected = chart.store?.getDatum?.(id)
      if (selected) {
        handlePersonSelection(selected, 'search')
        return
      }
      const fallbackLabel = resolveLabelFromSummary(id) || `Profil ${id}`
      requestSubtree({ mainId: id }, {
        source: 'search',
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
  }

  updateSearchOptionsForChart(chart)
  ensurePeopleSummary().then(() => {
    updateSearchOptionsForChart(chart)
  }).catch(() => {})
}

function renderChart(payload, options = {}) {
  const container = document.querySelector(chartSelector)
  if (!container) {
    throw new Error('Conteneur du graphique introuvable')
  }

  if (chartInstance && typeof chartInstance.unSetPersonSearch === 'function') {
    chartInstance.unSetPersonSearch()
  }

  container.innerHTML = ''
  resetDetails()

  const normalised = payload && payload.data !== undefined
    ? payload
    : normaliseTreePayload(payload)

  const dataArray = Array.isArray(normalised.data) ? normalised.data : []
  const rawConfig = normalised.config || {}

  const chart = f3.createChart(chartSelector, dataArray)
  const baseConfig = applyConfigToChart(chart, rawConfig)

  const mergedConfig = {
    ...baseConfig,
    mainId: options.mainId || baseConfig.mainId || viewerConfig.mainId || null,
    ancestryDepth: serverQueryState.ancestryDepth,
    progenyDepth: serverQueryState.progenyDepth,
    duplicateBranchToggle: options.preservePreferences && viewerConfig ? viewerConfig.duplicateBranchToggle !== false : baseConfig.duplicateBranchToggle,
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

  chartInstance = chart

  const initialCardDisplay = viewerConfig.cardDisplay && viewerConfig.cardDisplay.length
    ? viewerConfig.cardDisplay.map(row => [...row])
    : DEFAULT_CARD_DISPLAY.map(row => [...row])

  const card = chart.setCardHtml()
    .setCardDisplay(initialCardDisplay)
    .setMiniTree(viewerConfig.miniTree !== false)

  cardInstance = card

  chart.setDuplicateBranchToggle(viewerConfig.duplicateBranchToggle !== false)

  isApplyingViewerConfig = true
  updatePerformanceControlsUI(viewerConfig)
  isApplyingViewerConfig = false

  card.setOnCardClick((event, treeDatum) => {
    card.onCardClickDefault(event, treeDatum)
    const id = treeDatum?.data?.id
    if (!id) return
    const datum = chart.store?.getDatum?.(id)
    if (datum) {
      handlePersonSelection(datum, 'card')
    } else {
      const fallbackLabel = resolveLabelFromSummary(id) || `Profil ${id}`
      requestSubtree({ mainId: id }, {
        source: 'card',
        reposition: true,
        preservePreferences: true,
        selectedLabel: fallbackLabel,
        loadingLabel: `Selection : ${fallbackLabel}...`
      })
    }
  })

  if (viewerConfig.mainId) {
    chart.updateMainId(viewerConfig.mainId)
  }

  setupSearch(chart)

  applyViewerConfig({ reposition: options.reposition !== false, initial: options.preservePreferences === false })

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

  const branchCount = Number.isFinite(latestMeta.returned) ? latestMeta.returned : dataArray.length
  const totalCount = Number.isFinite(latestMeta.total) ? latestMeta.total : dataArray.length
  const name = mainDatum
    ? (buildFullName(mainDatum.data || {}) || `Profil ${mainDatum.id}`)
    : (options.selectedLabel || 'Branche courante')
  const prefix = options.source === 'search'
    ? 'Resultat'
    : options.source === 'card'
      ? 'Selection'
      : 'Branche'
  const depthSummary = buildDepthSummary(viewerConfig)
  setStatus(`${prefix} : ${name} - ${branchCount} profil(s) dans la branche / ${totalCount} au total - ${depthSummary}`, 'success')

  lastSelectionContext = { source: options.source || prefix.toLowerCase(), label: name }

  ensurePeopleSummary().then(() => {
    updateSearchOptionsForChart(chart)
  }).catch(() => {})
}

fetchFullTree({ preservePreferences: false, source: 'system' }).catch(() => {
  setStatus('Impossible de charger les données', 'error')
})
