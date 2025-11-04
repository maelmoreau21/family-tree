import * as f3 from '/lib/family-tree.esm.js'

const statusEl = document.getElementById('status')
const detailsPanel = document.getElementById('personDetails')
const searchContainer = document.getElementById('personSearch')
const detailsList = detailsPanel?.querySelector('.detail-list')
const detailsSummary = detailsPanel?.querySelector('.summary')
const emptyState = detailsPanel?.querySelector('.empty')
const chartSelector = '#FamilyChart'

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

let chartInstance = null

const DEFAULT_CHART_CONFIG = Object.freeze({
  transitionTime: 250,
  cardXSpacing: 240,
  cardYSpacing: 160,
  orientation: 'vertical',
  showSiblingsOfMain: true,
  singleParentEmptyCard: true,
  singleParentEmptyCardLabel: 'Inconnu',
  cardDisplay: DEFAULT_CARD_DISPLAY.map(row => [...row]),
  mainId: null
})

function normalizeCardDisplay(rows) {
  const safeRows = Array.isArray(rows) ? rows : []
  const normalized = safeRows.slice(0, 2).map(row => sanitizeFieldValues(Array.isArray(row) ? row : []))
  while (normalized.length < 2) normalized.push([])
  return normalized
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

  return config
}

function setStatus(message, type = 'info') {
  if (!statusEl) return
  statusEl.textContent = message
  statusEl.dataset.status = type
}

function resetDetails() {
  if (!detailsPanel || !emptyState || !detailsList || !detailsSummary) return
  detailsSummary.textContent = ''
  detailsSummary.classList.add('hidden')
  emptyState.textContent = 'Sélectionnez une personne pour afficher les informations.'
  emptyState.classList.remove('hidden')
  detailsList.innerHTML = ''
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
  if (!datum || !chartInstance) return
  chartInstance.updateMainId(datum.id)
  chartInstance.updateTree({ initial: false, tree_position: 'main_to_middle' })
  showDetailsForDatum(datum)

  const name = buildFullName(datum.data || {}) || `Profil ${datum.id}`
  const prefix = source === 'search' ? 'Résultat' : 'Sélectionné'
  setStatus(`${prefix} : ${name}`, 'info')

  if (source === 'search') {
    const input = searchContainer?.querySelector('input')
    if (input) {
      input.value = ''
      input.blur()
    }
  }
}

function setupSearch(chart) {
  if (!searchContainer) return

  chart.setPersonDropdown(datum => {
    const person = datum.data || {}
    const name = buildFullName(person) || 'Profil sans nom'
    const extras = []
    if (person['birthday']) extras.push(person['birthday'])
    if (person['death']) extras.push(`✝ ${person['death']}`)
    return extras.length ? `${name} (${extras.join(' · ')})` : name
  }, {
    cont: searchContainer,
    placeholder: 'Rechercher une personne…',
    onSelect: (id) => {
      const selected = chart.store?.getDatum?.(id)
      if (selected) {
        handlePersonSelection(selected, 'search')
      }
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
}

async function loadData() {
  setStatus("Chargement de l'arbre familial…")
  const response = await fetch('/api/tree', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Impossible de charger les données (${response.status})`)
  }
  return response.json()
}

function renderChart(payload) {
  const container = document.querySelector(chartSelector)
  if (!container) {
    throw new Error('Conteneur du graphique introuvable')
  }

  container.innerHTML = ''
  resetDetails()

  const { data, config } = normaliseTreePayload(payload)
  if (!Array.isArray(data)) {
    throw new Error('Format de données invalide reçu pour la visualisation')
  }

  const chart = f3.createChart(chartSelector, data)
  const appliedConfig = applyConfigToChart(chart, config)

  chartInstance = chart

  const dataArray = Array.isArray(data) ? data : []
  const desiredMainId = typeof appliedConfig.mainId === 'string' ? appliedConfig.mainId.trim() : ''
  if (desiredMainId && dataArray.some(person => person && person.id === desiredMainId)) {
    chart.updateMainId(desiredMainId)
  }

  const initialCardDisplay = appliedConfig.cardDisplay && appliedConfig.cardDisplay.length
    ? appliedConfig.cardDisplay.map(row => [...row])
    : DEFAULT_CARD_DISPLAY.map(row => [...row])

  const card = chart.setCardHtml()
    .setCardDisplay(initialCardDisplay)

  card.setOnCardClick((event, treeDatum) => {
    card.onCardClickDefault(event, treeDatum)
    const id = treeDatum?.data?.id
    if (!id) return
    const datum = chart.store?.getDatum?.(id)
    if (datum) {
      handlePersonSelection(datum, 'card')
    }
  })

  setupSearch(chart)

  chart.updateTree({ initial: true, tree_position: 'main_to_middle' })

  const mainDatum = chart.getMainDatum?.()
  if (mainDatum) {
    showDetailsForDatum(mainDatum)
    const name = buildFullName(mainDatum.data || {}) || `Profil ${mainDatum.id}`
    setStatus(`Visualisation prête ✅ – profil principal : ${name}`, 'success')
  } else {
    const total = Array.isArray(data) ? data.length : 0
    const spacingInfo = `Espacements cartes: ${appliedConfig.cardXSpacing} × ${appliedConfig.cardYSpacing}`
    setStatus(total > 0 ? `Visualisation prête ✅ – ${spacingInfo}` : 'Visualisation prête ✅', 'success')
  }
}

(async () => {
  try {
    const data = await loadData()
    resetDetails()
    renderChart(data)
  } catch (error) {
    console.error(error)
    setStatus(`Erreur: ${(error && error.message) || 'chargement impossible'}`, 'error')
    resetDetails()
  }
})()
