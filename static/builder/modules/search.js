
import { escapeHtml, buildPersonLabel, setBuilderSearchState, setSearchPanelFocusState } from './ui.js'
import { normalizeFieldKey } from './config.js'

let builderSearchOptions = []
let builderSearchReady = false
let builderSearchInput = null

export function initBuilderSearch(chart, { getAllPersons, onSelect }) {
    const searchTarget = document.querySelector('[data-role="builder-search-target"]')
    const searchEmptyEl = document.querySelector('[data-role="builder-search-empty"]')
    const searchLabel = document.getElementById('builderSearchLabel')
    const searchHint = document.getElementById('builderSearchHint')

    if (!chart || !searchTarget) {
        setBuilderSearchState('empty')
        return null
    }

    if (searchEmptyEl) {
        searchEmptyEl.classList.remove('hidden')
    }

    chart.setPersonDropdown(
        (datum) => buildPersonLabel(datum),
        {
            cont: searchTarget,
            placeholder: 'Rechercher (nom, date, lieu, etc.)',
            onSelect: (id) => {
                if (!id) return
                if (onSelect) onSelect(id)

                try {
                    const input = searchTarget.querySelector('input')
                    if (input) {
                        input.value = ''
                        input.blur()
                    }
                } catch (e) { }
            }
        }
    )

    const input = searchTarget.querySelector('input')
    if (input) {
        input.setAttribute('id', 'builderSearchInput')
        if (searchLabel) input.setAttribute('aria-labelledby', searchLabel.id)
        if (searchHint) input.setAttribute('aria-describedby', searchHint.id)
        input.setAttribute('autocomplete', 'off')
        input.setAttribute('spellcheck', 'false')
        builderSearchInput = input
        builderSearchInput.addEventListener('focus', () => setSearchPanelFocusState(true))
        builderSearchInput.addEventListener('blur', () => setSearchPanelFocusState(false))
    }

    function refreshSearchOptions() {
        if (!chart.personSearch) return
        const persons = getAllPersons()
        builderSearchOptions = buildSearchOptionsFromPersons(persons)
        chart.personSearch.setOptionsGetter(() => builderSearchOptions)
        setBuilderSearchState(builderSearchOptions.length ? 'ready' : 'empty')
        builderSearchReady = true
    }

    refreshSearchOptions()

    return {
        refreshSearchOptions
    }
}

function createSearchOptionFromDatum(datum) {
    if (!datum || typeof datum.id !== 'string' || !datum.id.trim()) return null
    const label = buildPersonLabel(datum)
    const tokens = new Set()
    const metaParts = []
    const metaSeen = new Set()

    const addToken = (value) => {
        if (typeof value !== 'string') return
        const trimmed = value.trim()
        if (!trimmed) return
        tokens.add(trimmed)
    }

    const addMeta = (value) => {
        if (typeof value !== 'string') return
        const trimmed = value.trim()
        if (!trimmed || metaSeen.has(trimmed)) return
        metaSeen.add(trimmed)
        metaParts.push(trimmed)
    }

    addToken(label)
    addToken(String(datum.id))

    const person = datum.data && typeof datum.data === 'object' ? datum.data : {}
    Object.entries(person).forEach(([rawKey, rawValue]) => {
        if (typeof rawValue !== 'string') return
        const trimmed = rawValue.trim()
        if (!trimmed) return
        addToken(trimmed)
        const key = normalizeFieldKey(rawKey)
        if (key === 'birthday') {
            addMeta(trimmed)
            return
        }
        if (key === 'death') {
            addMeta(`✝ ${trimmed}`)
            return
        }
        if (key === 'maiden name') {
            addMeta(`(${trimmed})`)
            return
        }
        if (key === 'occupation') {
            addMeta(trimmed)
            return
        }
        if (key === 'location' || key === 'residence' || key === 'birthplace' || key === 'deathplace') {
            addMeta(trimmed)
        }
    })

    const searchText = Array.from(tokens)
        .map(value => value.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' | ')

    return {
        label,
        value: datum.id,
        searchText,
        optionHtml: (option) => {
            const safeMetaParts = metaParts.map(part => escapeHtml(part))
            const meta = safeMetaParts.length ? `<small>${safeMetaParts.join(' · ')}</small>` : ''
            const safeLabel = option.label_html || escapeHtml(option.label)
            return `<div>${safeLabel}${meta ? `<div class="f3-autocomplete-meta">${meta}</div>` : ''}</div>`
        }
    }
}

function buildSearchOptionsFromPersons(persons) {
    if (!Array.isArray(persons)) return []
    const options = []
    const seen = new Set()
    persons.forEach(datum => {
        if (!datum || !datum.id || seen.has(datum.id)) return
        const option = createSearchOptionFromDatum(datum)
        if (!option) return
        options.push(option)
        seen.add(datum.id)
    })
    options.sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))
    return options
}

export function focusBuilderSearch({ label, select = true, flash = true, preventScroll = false } = {}) {
    const searchInput = document.getElementById('builderSearchInput')
    if (!searchInput) return

    if (label) {
        searchInput.value = label
    }

    if (!preventScroll) {
        searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    if (select) {
        searchInput.select()
    }

    if (flash) {
        searchInput.classList.add('flash')
        setTimeout(() => searchInput.classList.remove('flash'), 1000)
    }

    searchInput.focus()
}
