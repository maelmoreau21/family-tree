
export function setStatus(message, type = 'info') {
    const statusEl = document.getElementById('status')
    if (!statusEl) return
    try {
        if (typeof message === 'string') {
            statusEl.innerHTML = message.replace(/\n/g, '<br>')
        } else if (Array.isArray(message)) {
            statusEl.innerHTML = message.map(m => String(m)).join('<br>')
        } else {
            statusEl.textContent = String(message)
        }
    } catch (e) {
        statusEl.textContent = String(message)
    }
    statusEl.dataset.status = type
}

export function setChartLoading(isLoading, message = 'Chargement…') {
    const chartLoadingEl = document.querySelector('[data-role="chart-loading"]')
    const chartLoadingLabel = chartLoadingEl?.querySelector('[data-role="chart-loading-label"]')

    if (!chartLoadingEl) return

    if (isLoading) {
        chartLoadingEl.classList.remove('hidden')
        if (chartLoadingLabel) chartLoadingLabel.textContent = message
    } else {
        // Add a small delay to prevent flickering
        setTimeout(() => {
            chartLoadingEl.classList.add('hidden')
        }, 300)
    }
}

export function showEmptyTreeModal() {
    const emptyTreeModal = document.getElementById('emptyTreeModal')
    if (emptyTreeModal) emptyTreeModal.classList.remove('hidden')
}

export function hideEmptyTreeModal() {
    const emptyTreeModal = document.getElementById('emptyTreeModal')
    if (emptyTreeModal) emptyTreeModal.classList.add('hidden')
}

export function escapeHtml(text) {
    if (!text) return ''
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

export function buildPersonLabel(datum) {
    if (!datum) return 'Profil sans nom'
    const person = datum.data || {}
    const first = typeof person['first name'] === 'string' ? person['first name'].trim() : ''
    const last = typeof person['last name'] === 'string' ? person['last name'].trim() : ''
    const base = (first || last) ? [first, last].filter(Boolean).join(' ').trim() : `Profil ${datum.id}`
    return base || 'Profil sans nom'
}

export function setBuilderSearchState(state) {
    const searchRoot = document.querySelector('[data-role="builder-search"]')
    const searchInput = document.getElementById('builderSearchInput')

    if (!searchRoot) return

    searchRoot.dataset.state = state

    if (state === 'loading') {
        searchRoot.classList.add('loading')
        if (searchInput) searchInput.disabled = true
    } else {
        searchRoot.classList.remove('loading')
        if (searchInput) searchInput.disabled = false
    }
}

export function setSearchPanelFocusState(isFocused) {
    const searchRoot = document.querySelector('[data-role="builder-search"]')
    if (searchRoot) {
        if (isFocused) searchRoot.classList.add('focused')
        else searchRoot.classList.remove('focused')
    }
}


export function escapeSelector(str) {
    if (!str) return ''
    return CSS.escape(str)
}

export function initPanelToggle() {
    const toggleBtn = document.querySelector('[data-action="toggle-panel"]')
    const panel = document.getElementById('controlPanel')

    if (toggleBtn && panel) {
        toggleBtn.addEventListener('click', () => {
            const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true'
            toggleBtn.setAttribute('aria-expanded', !isExpanded)
            document.body.classList.toggle('controls-collapsed', isExpanded)

            // Update icon or text if needed
            const span = toggleBtn.querySelector('span')
            if (span) span.textContent = isExpanded ? 'Afficher' : 'Masquer'
        })
    }
}
