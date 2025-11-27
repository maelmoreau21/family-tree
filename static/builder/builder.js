
import * as f3 from '/lib/family-tree.esm.js'
import { buildChartConfig, DEFAULT_CHART_CONFIG } from './modules/config.js'
import { setStatus, setChartLoading, showEmptyTreeModal, hideEmptyTreeModal } from './modules/ui.js'
import { initData, loadTree, scheduleAutoSave, hasUnsavedChanges, setLastSnapshotString } from './modules/data.js'
import { initEditPanel, createEditPanel, openEditPanel, closeEditPanel } from './modules/edit-panel.js'
import { initBuilderSearch } from './modules/search.js'
import { initSettings, attachPanelControls } from './modules/settings.js'

let chart = null
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
    if (chart) applyChartConfigToChart(chart)
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
  const store = new f3.Store({
    data: dataArray,
    node_id: 'id',
    node_label: 'data.label'
  })

  const view = new f3.View({
    store,
    cont: document.querySelector('#FamilyChart'),
    card_display: chartConfig.cardDisplay || DEFAULT_CHART_CONFIG.cardDisplay,
    mini_tree: chartConfig.miniTree,
    node_separation: chartConfig.cardXSpacing,
    level_separation: chartConfig.cardYSpacing,
    duration: chartConfig.transitionTime,
  })

  const card = f3.elements.Card({
    store,
    svg: view.svg,
    card_dim: { width: 240, height: 150, img_w: 80, img_h: 80, img_x: 16, img_y: 16 },
    card_display: chartConfig.cardDisplay || DEFAULT_CHART_CONFIG.cardDisplay,
    mini_tree: chartConfig.miniTree,
    link_break: false,
    card_break: false,
    scale_initial: f3.elements.Card.SCALE_INITIAL.FIT,
  })

  view.setCard(card)
  chart = view

  applyChartConfigToChart(chart)

  createEditPanel()

  searchControlAPI = initBuilderSearch(chart, {
    getAllPersons: () => dataArray,
    onSelect: (id) => {
      if (activePanelControlAPI) activePanelControlAPI.setMainProfile(id, { source: 'search' })
    }
  })

  activePanelControlAPI = attachPanelControls()

  if (activePanelControlAPI) {
    activePanelControlAPI.syncMainProfileSelection()
    if (chartConfig.mainId) {
      activePanelControlAPI.setMainProfile(chartConfig.mainId, { persistConfig: false, openEditor: false })
    } else {
      const mainId = store.getMainId() || (dataArray[0] ? dataArray[0].id : null)
      if (mainId) activePanelControlAPI.setMainProfile(mainId, { persistConfig: false, openEditor: false })
    }
  }

  setChartLoading(false)
  setStatus(`Éditeur prêt ✅ – ${dataArray.length} personne(s) chargée(s)`, 'success')

  chart.updateTree({ initial: true })
}

function applyChartConfigToChart(chart) {
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
}

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges()) {
    e.preventDefault()
    e.returnValue = ''
  }
})

initialise()
