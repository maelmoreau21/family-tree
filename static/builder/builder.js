import * as f3 from '/lib/family-tree.esm.js'

const statusEl = document.getElementById('status')
const saveBtn = document.getElementById('save')
const reloadBtn = document.getElementById('reload')
const panel = document.getElementById('controlPanel')
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

const DISPLAY_FIELD_LABELS = new Map([
  ['first name', 'Prénom'],
  ['last name', 'Nom'],
  ['birthday', 'Date de naissance'],
  ['death', 'Décès'],
  ['gender', 'Genre'],
  ['avatar', 'Photo de profil'],
  ['photo', 'Photo'],
  ['picture', 'Portrait'],
  ['bio', 'Biographie'],
  ['occupation', 'Profession'],
  ['location', 'Lieu de résidence'],
  ['birthplace', 'Lieu de naissance'],
  ['deathplace', 'Lieu de décès'],
  ['notes', 'Notes'],
  ['nickname', 'Surnom'],
  ['maiden name', 'Nom de jeune fille']
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
    { value: 'death', checked: false },
    { value: 'avatar', checked: false },
    { value: 'gender', checked: false }
  ]
}

const EDITABLE_DEFAULTS = [
  { value: 'first name', label: 'Prénom', checked: true },
  { value: 'last name', label: 'Nom', checked: true },
  { value: 'birthday', label: 'Date de naissance', checked: true },
  { value: 'avatar', label: 'Avatar', checked: true },
  { value: 'gender', label: 'Genre', checked: true },
  { value: 'death', label: 'Décès', checked: false },
  { value: 'bio', label: 'Biographie', checked: false }
]

const DEFAULT_CARD_DISPLAY = [
  ['first name', 'last name'],
  ['birthday']
]

const DEFAULT_EDITABLE_FIELDS = sanitizeFieldValues(
  EDITABLE_DEFAULTS
    .filter(def => def.checked !== false)
    .map(def => def.value)
)

const DEFAULT_CHART_CONFIG = Object.freeze({
  transitionTime: 250,
  cardXSpacing: 240,
  cardYSpacing: 160,
  orientation: 'vertical',
  showSiblingsOfMain: true,
  singleParentEmptyCard: true,
  singleParentEmptyCardLabel: 'Inconnu',
  editableFields: [...DEFAULT_EDITABLE_FIELDS],
  cardDisplay: DEFAULT_CARD_DISPLAY.map(row => [...row])
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
    editableFields: [...DEFAULT_EDITABLE_FIELDS],
    cardDisplay: cloneCardDisplay(DEFAULT_CARD_DISPLAY)
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

  if (Array.isArray(overrides.editableFields)) {
    const sanitizedEditable = sanitizeFieldValues(overrides.editableFields)
    if (sanitizedEditable.length) {
      base.editableFields = sanitizedEditable
    }
  }

  if (Array.isArray(overrides.cardDisplay) || (overrides.cardDisplay && typeof overrides.cardDisplay === 'object')) {
    base.cardDisplay = cloneCardDisplay(overrides.cardDisplay, [[], []])
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

function setStatus(message, type = 'info') {
  if (!statusEl) return
  statusEl.textContent = message
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

  return config
}

function applyChartConfigToChart(chart) {
  chart.setTransitionTime(chartConfig.transitionTime)
  chart.setCardXSpacing(chartConfig.cardXSpacing)
  chart.setCardYSpacing(chartConfig.cardYSpacing)
  chart.setShowSiblingsOfMain(chartConfig.showSiblingsOfMain)

  if (chartConfig.orientation === 'horizontal') {
    chart.setOrientationHorizontal()
  } else {
    chart.setOrientationVertical()
  }

  chart.setSingleParentEmptyCard(chartConfig.singleParentEmptyCard, {
    label: chartConfig.singleParentEmptyCardLabel
  })
}

async function loadTree() {
  setStatus('Chargement des données…')
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

  container.innerHTML = ''

  const { data, config } = normaliseTreePayload(payload)
  chartConfig = buildChartConfig(normaliseChartConfig(config))
  currentEditableFields = [...chartConfig.editableFields]

  const chart = f3.createChart(chartSelector, data)
  applyChartConfigToChart(chart)

  const initialCardDisplay = chartConfig.cardDisplay && chartConfig.cardDisplay.length
    ? chartConfig.cardDisplay.map(row => [...row])
    : cloneCardDisplay(DEFAULT_CARD_DISPLAY)

  const card = chart.setCardHtml()
    .setCardDisplay(initialCardDisplay)
    .setCardImageField('avatar')

  editTreeInstance = chart.editTree()
    .setFields([
      'first name',
      'last name',
      'birthday',
      'death',
      'gender',
      'avatar',
      'bio'
    ])
    .setEditFirst(true)
    .setCardClickOpen(card)
    .setOnChange(() => {
      lastSnapshotString = null
      scheduleAutoSave()
    })

  attachPanelControls({ chart, card })

  chart.updateTree({ initial: true, tree_position: 'fit' })

  const mainDatum = chart.getMainDatum()
  if (mainDatum) {
    editTreeInstance.open(mainDatum)
  }

  const initialSnapshot = getSnapshot()
  lastSnapshotString = initialSnapshot ? JSON.stringify(initialSnapshot) : null
  const totalPersons = Array.isArray(data) ? data.length : 0
  setStatus(totalPersons > 0 ? `Éditeur prêt ✅ – ${totalPersons} personne(s) chargée(s)` : 'Fichier de données vide', totalPersons > 0 ? 'success' : 'error')
}

function attachPanelControls({ chart, card }) {
  if (!panel) return

  const editableFieldset = panel.querySelector('[data-role="editable-fields"]')
  const editableList = editableFieldset?.querySelector('.editable-list')
  const addEditableBtn = editableFieldset?.querySelector('[data-action="add-editable"]')
  const displayGroups = [...panel.querySelectorAll('[data-display-row]')]
  const displayGroupMap = new Map(displayGroups.map(group => [group.dataset.displayRow, group]))
  const fieldLabelStore = new Map(DISPLAY_FIELD_LABELS)

  EDITABLE_DEFAULTS.forEach(def => {
    fieldLabelStore.set(normalizeFieldKey(def.value), def.label)
  })

  Object.values(DISPLAY_DEFAULTS).forEach(defs => {
    defs.forEach(def => {
      if (def.label) {
        fieldLabelStore.set(normalizeFieldKey(def.value), def.label)
      }
    })
  })

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
  const orientationButtons = panel.querySelectorAll('[data-orientation]')
  const cardWidth = panel.querySelector('#cardWidth')
  const cardHeight = panel.querySelector('#cardHeight')
  const imgWidth = panel.querySelector('#imgWidth')
  const imgHeight = panel.querySelector('#imgHeight')
  const imgX = panel.querySelector('#imgX')
  const imgY = panel.querySelector('#imgY')
  const resetDimensions = panel.querySelector('#resetDimensions')

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
    setOrientationButtonsState(chartConfig.orientation || DEFAULT_CHART_CONFIG.orientation)
  }

  function commitConfigUpdate(partialConfig = {}, { treePosition = 'inherit', refresh = true } = {}) {
    chartConfig = { ...chartConfig, ...partialConfig }
    applyChartConfigToChart(chart)
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

  function ensureFieldLabel(value, label) {
  const key = normalizeFieldKey(value)
    if (label) {
      fieldLabelStore.set(key, label.trim() || value)
    } else if (!fieldLabelStore.has(key)) {
      fieldLabelStore.set(key, value)
    }
    return fieldLabelStore.get(key) || value
  }

  function escapeSelector(value) {
    if (window.CSS?.escape) return window.CSS.escape(value)
    return value.replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`)
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
    editTreeInstance.setFields(applied)

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
    createEditableItem({
      value: def.value,
      label: def.label,
      checked: def.checked !== false,
      removable: false
    })
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

  const previousApplyingState = isApplyingConfig
  isApplyingConfig = true
  ensureConfigEditableItems()
  refreshConfigControls()
  applyConfigToEditableControls()
  applyConfigToDisplayControls()
  isApplyingConfig = previousApplyingState

  applyEditableFields({ suppressSave: true })
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
