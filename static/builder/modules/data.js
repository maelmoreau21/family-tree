
import { setStatus, setChartLoading } from './ui.js'

let autoSaveTimer = null
let lastSnapshotString = null
let isSaving = false
let queuedSave = null
let getSnapshotFn = null

export function initData(snapshotCallback) {
    getSnapshotFn = snapshotCallback
}

export function structuredCloneSafe(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value)
    }
    return JSON.parse(JSON.stringify(value))
}

export async function loadTree() {
    setStatus('Chargement des données…')
    setChartLoading(true, 'Chargement des données…')
    const response = await fetch('/api/tree', { cache: 'no-store' })
    if (!response.ok) {
        throw new Error(`Échec du chargement (${response.status})`)
    }
    return response.json()
}

export function destroyTimer() {
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer)
        autoSaveTimer = null
    }
}

export function scheduleAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(() => {
        if (getSnapshotFn) {
            const snapshot = getSnapshotFn()
            persistChanges(snapshot)
        }
    }, 2000)
}

export async function persistChanges(snapshot, { immediate = false } = {}) {
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

export function hasUnsavedChanges(currentSnapshot) {
    if (!currentSnapshot) return false
    const currentString = JSON.stringify(currentSnapshot)
    return currentString !== lastSnapshotString
}

export function setLastSnapshotString(str) {
    lastSnapshotString = str
}
