
import * as f3 from '/lib/family-tree.esm.js'
import { buildChartConfig, DEFAULT_CHART_CONFIG } from './modules/config.js'
import { setStatus, setChartLoading, showEmptyTreeModal, hideEmptyTreeModal } from './modules/ui.js'
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

function setupChart() {
  // Use createChart from the library
  chart = f3.createChart('#FamilyChart', dataArray)

  // Set up the card using the cardSvg factory
  card = chart.setCard(f3.cardSvg)

  // Configure initial card dimensions
  if (card && card.setCardDim) {
    card.setCardDim({
      width: 240, height: 150,
      img_w: 80, img_h: 80,
      img_x: 16, img_y: 16
    })
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
    // If we had card style or image field config, we would apply it here
    // e.g. card.setCardImageField(chartConfig.imageField)
  }
}

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges()) {
    e.preventDefault()
    e.returnValue = ''
  }
})

initialise()
