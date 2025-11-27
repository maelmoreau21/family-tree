
import { FIELD_LABELS } from './config.js'
import { scheduleAutoSave } from './data.js'
import { setStatus } from './ui.js'

let context = {
    chart: null,
    dataArray: [],
    chartConfig: null
}

let activePersonId = null

export function initEditPanel(ctx) {
    context = ctx
}

export function createEditPanel() {
    let panel = document.getElementById('customEditPanel')
    if (panel) return panel

    panel = document.createElement('div')
    panel.id = 'customEditPanel'
    panel.className = 'edit-person-form'
    panel.style.position = 'fixed'
    panel.style.top = '0'
    panel.style.right = '-400px'
    panel.style.width = '350px'
    panel.style.height = '100%'
    panel.style.backgroundColor = 'var(--bg-color, #fff)'
    panel.style.boxShadow = '-2px 0 5px rgba(0,0,0,0.1)'
    panel.style.zIndex = '1000'
    panel.style.transition = 'right 0.3s ease'
    panel.style.display = 'flex'
    panel.style.flexDirection = 'column'

    document.body.appendChild(panel)
    return panel
}

export function openEditPanel(datum) {
    const panel = createEditPanel()
    panel.innerHTML = ''
    activePersonId = datum.id

    // Header
    const header = document.createElement('div')
    header.className = 'edit-panel-header'
    header.style.padding = '15px'
    header.style.borderBottom = '1px solid var(--border-color, #ddd)'
    header.style.display = 'flex'
    header.style.justifyContent = 'space-between'
    header.style.alignItems = 'center'

    const title = document.createElement('h2')
    title.textContent = datum.data.label || 'Personne'
    title.style.margin = '0'
    title.style.fontSize = '1.2rem'

    const closeBtn = document.createElement('button')
    closeBtn.innerHTML = '&times;'
    closeBtn.style.background = 'none'
    closeBtn.style.border = 'none'
    closeBtn.style.fontSize = '1.5rem'
    closeBtn.style.cursor = 'pointer'
    closeBtn.onclick = closeEditPanel

    header.append(title, closeBtn)
    panel.append(header)

    // Tabs
    const tabsRow = document.createElement('div')
    tabsRow.className = 'edit-tabs-row'
    tabsRow.style.display = 'flex'
    tabsRow.style.borderBottom = '1px solid var(--border-color, #ddd)'

    const detailsTab = document.createElement('button')
    detailsTab.textContent = 'Détails'
    detailsTab.className = 'tab-button active'
    detailsTab.style.flex = '1'
    detailsTab.style.padding = '10px'
    detailsTab.style.background = 'none'
    detailsTab.style.border = 'none'
    detailsTab.style.cursor = 'pointer'
    detailsTab.onclick = () => switchPanelTab('details')

    const filesTab = document.createElement('button')
    filesTab.textContent = 'Fichiers'
    filesTab.className = 'tab-button'
    filesTab.style.flex = '1'
    filesTab.style.padding = '10px'
    filesTab.style.background = 'none'
    filesTab.style.border = 'none'
    filesTab.style.cursor = 'pointer'
    filesTab.onclick = () => switchPanelTab('files')

    tabsRow.append(detailsTab, filesTab)
    panel.append(tabsRow)

    // Content Container
    const contentContainer = document.createElement('div')
    contentContainer.style.flex = '1'
    contentContainer.style.overflowY = 'auto'
    contentContainer.style.padding = '15px'
    panel.append(contentContainer)

    // Details Content
    const detailsContent = document.createElement('div')
    detailsContent.id = 'panel-details'

    // Image Upload
    const imageContainer = document.createElement('div')
    imageContainer.className = 'profile-image-upload'
    imageContainer.innerHTML = `<div class="drop-zone" id="dropZone" style="border: 2px dashed #ccc; padding: 20px; text-align: center; margin-bottom: 20px; cursor: pointer;">
    <p style="margin: 0;">Glissez une image ici ou cliquez</p>
    <input type="file" accept="image/*" class="hidden" style="display: none;">
  </div>`
    imageContainer.onclick = () => imageContainer.querySelector('input').click()
    imageContainer.querySelector('input').onchange = (e) => handleImageUpload(e.target.files[0], datum.id)

    // Drag & Drop
    const dropZone = imageContainer.querySelector('.drop-zone')
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = '#007bff'; }
    dropZone.ondragleave = () => { dropZone.style.borderColor = '#ccc'; }
    dropZone.ondrop = (e) => {
        e.preventDefault()
        dropZone.style.borderColor = '#ccc'
        if (e.dataTransfer.files[0]) handleImageUpload(e.dataTransfer.files[0], datum.id)
    }

    // Show current image if exists
    const imageField = context.chartConfig?.imageField || 'avatar'
    if (datum.data[imageField]) {
        dropZone.innerHTML = `<img src="${datum.data[imageField]}" style="max-width: 100%; max-height: 150px; border-radius: 4px;">`
    }

    detailsContent.append(imageContainer)

    // Fields
    const currentEditableFields = context.chartConfig?.editableFields || []
    if (currentEditableFields && currentEditableFields.length) {
        currentEditableFields.forEach(fieldKey => {
            const group = document.createElement('div')
            group.style.marginBottom = '15px'

            const label = document.createElement('label')
            label.textContent = FIELD_LABELS[fieldKey] || fieldKey
            label.style.display = 'block'
            label.style.marginBottom = '5px'
            label.style.fontWeight = 'bold'

            const input = document.createElement('input')
            input.type = 'text'
            input.value = datum.data[fieldKey] || ''
            input.style.width = '100%'
            input.style.padding = '8px'
            input.style.border = '1px solid #ccc'
            input.style.borderRadius = '4px'

            input.addEventListener('input', (e) => {
                datum.data[fieldKey] = e.target.value
                if (context.chart) context.chart.updateTree({ initial: false, tree_position: 'inherit' })
                scheduleAutoSave()
            })

            group.append(label, input)
            detailsContent.append(group)
        })
    }

    // Unions
    const unionsContainer = document.createElement('div')
    unionsContainer.innerHTML = '<h3 style="margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Unions</h3>'
    if (datum.rels && datum.rels.spouses && datum.rels.spouses.length) {
        datum.rels.spouses.forEach(spouseId => {
            const spouse = context.dataArray.find(p => p.id === spouseId)
            const div = document.createElement('div')
            div.style.padding = '8px'
            div.style.backgroundColor = '#f9f9f9'
            div.style.marginBottom = '5px'
            div.style.borderRadius = '4px'
            div.textContent = spouse ? (spouse.data.label || spouseId) : spouseId
            unionsContainer.append(div)
        })
    } else {
        unionsContainer.innerHTML += '<p style="color: #666; font-style: italic;">Aucune union</p>'
    }
    detailsContent.append(unionsContainer)
    contentContainer.append(detailsContent)

    // Files Content
    const filesContent = document.createElement('div')
    filesContent.id = 'panel-files'
    filesContent.style.display = 'none'

    const fileListContainer = document.createElement('div')
    fileListContainer.id = 'personFileList'
    filesContent.append(fileListContainer)

    contentContainer.append(filesContent)

    // Show Panel
    panel.style.right = '0'

    // Load files
    updateFilePanel(datum.id)
}

export function closeEditPanel() {
    const panel = document.getElementById('customEditPanel')
    if (panel) panel.style.right = '-400px'
    activePersonId = null
}

export function switchPanelTab(tabName) {
    const details = document.getElementById('panel-details')
    const files = document.getElementById('panel-files')
    const tabs = document.querySelectorAll('.tab-button')

    if (tabName === 'details') {
        details.style.display = 'block'
        files.style.display = 'none'
        tabs[0].classList.add('active')
        tabs[1].classList.remove('active')
    } else {
        details.style.display = 'none'
        files.style.display = 'block'
        tabs[0].classList.remove('active')
        tabs[1].classList.add('active')
    }
}

async function handleImageUpload(file, personId) {
    if (!file || !personId) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('personId', personId)
    formData.append('type', 'profile')

    setStatus('Téléversement...', 'saving')

    try {
        const resp = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!resp.ok) throw new Error('Upload failed')
        const data = await resp.json()

        // Update person data
        const datum = context.dataArray.find(p => p.id === personId)
        if (datum) {
            datum.data[context.chartConfig?.imageField || 'avatar'] = data.url
            if (context.chart) context.chart.updateTree({ initial: false, tree_position: 'inherit' })
            scheduleAutoSave()

            // Refresh panel image preview if needed
            const dropZone = document.getElementById('dropZone')
            if (dropZone) dropZone.innerHTML = `<img src="${data.url}" style="max-width: 100%; max-height: 150px; border-radius: 4px;">`
        }
        setStatus('Photo mise à jour', 'success')
    } catch (e) {
        console.error(e)
        setStatus('Erreur lors du téléversement', 'error')
    }
}

// File Management Functions

async function updateFilePanel(personId) {
    const personFileList = document.getElementById('personFileList')
    if (!personFileList) return
    personFileList.innerHTML = '<p class="hint">Chargement...</p>'

    if (!personId) {
        personFileList.innerHTML = ''
        return
    }

    try {
        const res = await fetch(`/api/document/${personId}`)
        const files = await res.json()
        renderFileList(files, personId)
    } catch (e) {
        console.error(e)
        personFileList.innerHTML = '<p class="hint error">Erreur de chargement.</p>'
    }
}

function renderFileList(files, personId) {
    const personFileList = document.getElementById('personFileList')
    personFileList.innerHTML = ''
    if (!files.length) {
        personFileList.innerHTML = '<p class="hint">Aucun fichier.</p>'
        return
    }

    const ul = document.createElement('ul')
    ul.className = 'file-list-items'

    files.forEach(file => {
        const li = document.createElement('li')
        li.className = 'file-item'

        const link = document.createElement('a')
        link.href = file.url
        link.target = '_blank'
        link.textContent = file.name

        const actions = document.createElement('div')
        actions.className = 'file-actions'

        const renameBtn = document.createElement('button')
        renameBtn.type = 'button'
        renameBtn.className = 'ghost small'
        renameBtn.textContent = '✏️'
        renameBtn.onclick = () => promptRenameFile(personId, file.name)

        const deleteBtn = document.createElement('button')
        deleteBtn.type = 'button'
        deleteBtn.className = 'ghost small text-danger'
        deleteBtn.textContent = '🗑️'
        deleteBtn.onclick = () => confirmDeleteFile(personId, file.name)

        actions.append(renameBtn, deleteBtn)
        li.append(link, actions)
        ul.append(li)
    })
    personFileList.append(ul)
}

async function promptRenameFile(personId, oldName) {
    const newName = prompt('Nouveau nom (sans extension) :', oldName.replace(/\.[^/.]+$/, ""))
    if (newName && newName !== oldName) {
        try {
            await fetch(`/api/document/${personId}/rename`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldName, newName })
            })
            updateFilePanel(personId)
        } catch (e) {
            alert('Erreur lors du renommage.')
        }
    }
}

async function confirmDeleteFile(personId, filename) {
    if (confirm(`Supprimer ${filename} ?`)) {
        try {
            await fetch(`/api/document/${personId}/${filename}`, { method: 'DELETE' })
            updateFilePanel(personId)
        } catch (e) {
            alert('Erreur lors de la suppression.')
        }
    }
}
