
import * as f3 from '/lib/family-tree.esm.js'
import { buildChartConfig, DEFAULT_CHART_CONFIG } from './modules/config.js'
import { setStatus, setChartLoading, showEmptyTreeModal, hideEmptyTreeModal, initPanelToggle } from './modules/ui.js'
import { initData, loadTree, scheduleAutoSave, hasUnsavedChanges, setLastSnapshotString } from './modules/data.js'
import { initEditPanel, createEditPanel, openEditPanel, closeEditPanel } from './modules/edit-panel.js'
import { initBuilderSearch } from './modules/search.js'
import { initSettings, attachPanelControls } from './modules/settings.js'

let chart = null
let card = null
let dataArray = []
let chartConfig = buildChartConfig()
let activePanelControlAPI = null
let searchControlAPI = null

const context = {
  get chart() { return chart },
  get dataArray() { return dataArray },
  getChartConfig: () => chartConfig,
  updateChartConfig: (newConfig) => {
    chartConfig = { ...chartConfig, ...newConfig }
    if (chart) applyChartConfigToChart(chart, card)
  }
}

initSettings(context)
initEditPanel(context)
initData(() => ({ data: dataArray, config: chartConfig }))

async function initialise() {
  try {
    const { data, config } = await loadTree()
    dataArray = data || []
    if (config) {
      chartConfig = buildChartConfig(config)
    }
    setLastSnapshotString(JSON.stringify({ data: dataArray, config: chartConfig }))
  } catch (e) {
    console.error(e)
    setStatus('Erreur lors du chargement des données.', 'error')
    setChartLoading(false)
    return
  }

  if (!dataArray.length) {
    showEmptyTreeModal()
    setChartLoading(false)
    return
  }

  setupChart()
}

function sanitizeCardDim(dim) {
  if (!dim || typeof dim !== 'object') return null
  const newDim = {}
  for (const key in dim) {
    const val = Number(dim[key])
    if (!isNaN(val)) {
      newDim[key] = val
    }
  }
  // Ensure w/h aliases exist
  if (newDim.width && !newDim.w) newDim.w = newDim.width
  if (newDim.height && !newDim.h) newDim.h = newDim.height
  if (newDim.w && !newDim.width) newDim.width = newDim.w
  if (newDim.h && !newDim.height) newDim.height = newDim.h

  // Ensure img aliases
  if (newDim.img_width && !newDim.img_w) newDim.img_w = newDim.img_width
  if (newDim.img_height && !newDim.img_h) newDim.img_h = newDim.img_height

  return newDim
}

function setupChart() {
  console.log('Setting up chart...')
  initPanelToggle() // Initialize panel toggle

  // Use createChart from the library
  chart = f3.createChart('#FamilyChart', dataArray)

  // Set up the card using the cardSvg factory
  card = chart.setCard(f3.cardSvg)

  // Configure initial card dimensions using config defaults
  if (card && card.setCardDim) {
    const dim = chartConfig.cardDim || {
      width: 240, height: 150,
      w: 240, h: 150,
      img_w: 80, img_h: 80,
      img_width: 80, img_height: 80,
      img_x: 16, img_y: 16,
      text_x: 100, text_y: 15
    }

    const sanitizedDim = sanitizeCardDim(dim)
    if (sanitizedDim) {
      console.log('Setting initial card dim:', sanitizedDim)
      card.setCardDim(sanitizedDim)
    }

    // Set card click handler to open edit panel
    if (card.setOnCardClick) {
      card.setOnCardClick((e, d) => {
        if (activePanelControlAPI) {
          activePanelControlAPI.setMainProfile(d.data.id, { source: 'card-click', openEditor: true })
        } else {
          openEditPanel(d)
        }
      })
    }
  }

  // Apply configuration
  applyChartConfigToChart(chart, card)

  // Initialize Edit Panel
  createEditPanel()

  // Initialize Search
  searchControlAPI = initBuilderSearch(chart, {
    getAllPersons: () => dataArray,
    onSelect: (id) => {
      if (activePanelControlAPI) activePanelControlAPI.setMainProfile(id, { source: 'search' })
    }
  })

  // Initialize Settings Panel
  activePanelControlAPI = attachPanelControls()

  // Set Initial Main Profile
  if (activePanelControlAPI) {
    activePanelControlAPI.syncMainProfileSelection()
    if (chartConfig.mainId) {
      activePanelControlAPI.setMainProfile(chartConfig.mainId, { persistConfig: false, openEditor: false })
    } else {
      const mainId = (chart.store && chart.store.getMainId()) || (dataArray[0] ? dataArray[0].id : null)
      if (mainId) activePanelControlAPI.setMainProfile(mainId, { persistConfig: false, openEditor: false })
    }
  }

  setChartLoading(false)
  setStatus(`Éditeur prêt ✅ – ${dataArray.length} personne(s) chargée(s)`, 'success')

  // Initial update
  console.log('Updating tree...')
  chart.updateTree({ initial: true })
}

function applyChartConfigToChart(chart, card) {
  if (!chart) return

  if (chart.setTransitionTime) chart.setTransitionTime(chartConfig.transitionTime)
  if (chart.setCardXSpacing) chart.setCardXSpacing(chartConfig.cardXSpacing)
  if (chart.setCardYSpacing) chart.setCardYSpacing(chartConfig.cardYSpacing)
  if (chart.setShowSiblingsOfMain) chart.setShowSiblingsOfMain(chartConfig.showSiblingsOfMain)
  if (chart.setLinkStyle) chart.setLinkStyle(chartConfig.linkStyle || 'legacy')

  if (chart.setOrientation) {
    if (chartConfig.orientation === 'horizontal') chart.setOrientationHorizontal()
    else chart.setOrientationVertical()
  }

  if (chart.setAncestryDepth) chart.setAncestryDepth(chartConfig.ancestryDepth)
  if (chart.setProgenyDepth) chart.setProgenyDepth(chartConfig.progenyDepth)
  if (chart.setMiniTree) chart.setMiniTree(chartConfig.miniTree)

  // Card specific updates
  if (card) {
    if (card.setCardDisplay) card.setCardDisplay(chartConfig.cardDisplay || DEFAULT_CHART_CONFIG.cardDisplay)
    if (card.setMiniTree) card.setMiniTree(chartConfig.miniTree)

    // Apply card dimensions from config if present
    if (chartConfig.cardDim && card.setCardDim) {
      const sanitizedDim = sanitizeCardDim(chartConfig.cardDim)
      if (sanitizedDim) {
        console.log('Applying sanitized card dim from config:', sanitizedDim)
        card.setCardDim(sanitizedDim)
      }
    }
  }
}

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges()) {
    e.preventDefault()
    e.returnValue = ''
  }
})

initialise()
