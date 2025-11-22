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
  if (persistConfig) {
    transientMainSelection = false
  }
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
  copyToClipboard(value, {
    successMessage: 'Image appliquée et URL copiée ✅',
    errorMessage: 'Impossible de copier ce lien.'
  })
})

// GEDCOM Import Handler
const gedcomUploadInput = document.getElementById('gedcomUpload')
gedcomUploadInput?.addEventListener('change', async (event) => {
  const file = event.target.files && event.target.files[0]
  if (!file) return

  if (!confirm('Attention : L\'import GEDCOM va REMPLACER toutes les données actuelles. Voulez-vous continuer ?')) {
    event.target.value = ''
    return
  }

  const formData = new FormData()
  formData.append('file', file)
  body: formData
})

if (!response.ok) throw new Error('Erreur lors de l\'import')

const result = await response.json()
setStatus(`Import réussi : ${result.count} individus importés.`, 'success')

// Reload tree
await initialise()
  } catch (error) {
  console.error(error)
  setStatus('Erreur lors de l\'import GEDCOM', 'error')
  setChartLoading(false)
} finally {
  event.target.value = ''
}
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

    // Init Source Manager
    const sourceContainer = document.getElementById('sourceManagerContainer')
    if (sourceContainer) {
      // Ensure sources array exists in payload
      if (!data.sources) data.sources = []
      currentSources = data.sources

      sourceManager = new SourceManager(sourceContainer, data)
      sourceManager.onUpdate = (newSources) => {
        currentSources = newSources
        // Update global payload and save
        // We need to access the current full payload to update sources
        const snapshot = getSnapshot()
        if (snapshot) {
          snapshot.sources = newSources
          persistChanges(snapshot, { immediate: true })
        }
      }
    }
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
