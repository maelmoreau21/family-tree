import * as d3 from "d3"
import * as icons from "../renderers/icons"
import { Store } from "../types/store"
import { Data } from "../types/data"
import { updateSelectionHtml } from "../utils/safe-html"

interface HistoryData extends Data {
  main_id: string
}

export interface History {
  changed: () => void
  back: () => void
  forward: () => void
  canForward: () => boolean
  canBack: () => boolean
}

export interface HistoryControls {
  back_btn: HTMLElement
  forward_btn: HTMLElement
  updateButtons: () => void
  destroy: () => void
}

export interface HistoryWithControls extends History {
  controls: HistoryControls
}

export function createHistory(store: Store, getStoreDataCopy: () => Data, onUpdate: () => void): History {
  let history: HistoryData[] = []
  let history_index = -1
  
  return {
    changed,
    back,
    forward,
    canForward,
    canBack
  }

  function changed() {
    if (history_index < history.length - 1) history = history.slice(0, history_index+1)
    const clean_data = getStoreDataCopy() as HistoryData
    clean_data.main_id = store.getMainId()
    history.push(clean_data)
    history_index++
  }

  function back() {
    if (!canBack()) return
    history_index--
    updateData(history[history_index])
  }

  function forward() {
    if (!canForward()) return
    history_index++
    updateData(history[history_index])
  }

  function canForward() {
    return history_index < history.length - 1
  }

  function canBack() {
    return history_index > 0
  }

  function updateData(data: HistoryData) {
    const current_main_id = store.getMainId()
    data = JSON.parse(JSON.stringify(data))
    if (!data.find(d => d.id === current_main_id)) store.updateMainId(data.main_id)
    store.updateData(data)
    onUpdate()
  }
}

// createHistoryControls removed: history UI controls have been removed from the codebase