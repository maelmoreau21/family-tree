
export const EDITABLE_DEFAULTS = [
    { value: 'first name', label: 'Prénom', checked: true },
    { value: 'last name', label: 'Nom', checked: true },
    { value: 'gender', label: 'Genre', checked: true },
    { value: 'birthday', label: 'Date de naissance', checked: true },
    { value: 'death', label: 'Date de décès', checked: true },
    { value: 'birthplace', label: 'Lieu de naissance', checked: false },
    { value: 'deathplace', label: 'Lieu de décès', checked: false },
    { value: 'location', label: 'Lieu de résidence', checked: false },
    { value: 'occupation', label: 'Métier', checked: false },
    { value: 'bio', label: 'Biographie', checked: false },
    { value: 'nationality', label: 'Nationalité', checked: false },
    { value: 'maiden name', label: 'Nom de jeune fille', checked: false }
]

export const DISPLAY_DEFAULTS = {
    row1: [
        { value: 'first name', label: 'Prénom' },
        { value: 'last name', label: 'Nom' }
    ],
    row2: [
        { value: 'birthday', label: 'Date de naissance' },
        { value: 'death', label: 'Date de décès' },
        { value: 'occupation', label: 'Métier' }
    ]
}

export const DISPLAY_FIELD_LABELS = [
    ['first name', 'Prénom'],
    ['last name', 'Nom'],
    ['gender', 'Genre'],
    ['birthday', 'Date de naissance'],
    ['death', 'Date de décès'],
    ['birthplace', 'Lieu de naissance'],
    ['deathplace', 'Lieu de décès'],
    ['location', 'Lieu de résidence'],
    ['occupation', 'Métier'],
    ['bio', 'Biographie'],
    ['nationality', 'Nationalité'],
    ['maiden name', 'Nom de jeune fille']
]

export const DEFAULT_CARD_DISPLAY = [
    ['first name', 'last name'],
    ['birthday']
]

export const UNION_PARAGRAPH_KEY = 'union paragraph'

export function sanitizeFieldValues(values) {
    if (!Array.isArray(values)) return []
    return values.map(v => typeof v === 'string' ? v.trim() : '').filter(Boolean)
}

export const DEFAULT_EDITABLE_FIELDS = sanitizeFieldValues(
    EDITABLE_DEFAULTS
        .filter(def => def.checked !== false)
        .map(def => def.value)
)

export const TEXTAREA_FIELD_KEYS = new Set(['bio', 'notes', 'biographie', 'description'])
export const UNION_FIELD_SPECS = [
    { key: 'union date', kind: 'date' },
    { key: 'union place', kind: 'place' }
]

export const FIELD_LABELS = Object.fromEntries(DISPLAY_FIELD_LABELS)

export function normalizeFieldKey(key) {
    if (typeof key !== 'string') return ''
    return key.trim().toLowerCase()
}

export function getUnionFieldKind(value) {
    if (value === undefined || value === null) return null
    const normalized = normalizeFieldKey(value)
    if (!normalized) return null
    const cleaned = normalized.replace(/[^a-z]+/g, '')
    if (cleaned === 'uniondate' || (normalized.startsWith('union') && normalized.includes('date'))) {
        return 'date'
    }
    if (cleaned === 'unionplace' || (normalized.startsWith('union') && normalized.includes('place'))) {
        return 'place'
    }
    return null
}

export function createFieldDescriptor(key, value, label, buildPersonLabelFn) {
    if (getUnionFieldKind(key)) {
        return {
            id: value,
            label,
            type: 'rel_reference',
            rel_type: 'spouse',
            getRelLabel: buildPersonLabelFn // We need to pass this function or handle it differently
        }
    }
    const type = TEXTAREA_FIELD_KEYS.has(key) ? 'textarea' : 'text'
    return { id: value, label, type }
}

export function appendUnionFieldDescriptors(descriptors, labelLookup, buildPersonLabelFn) {
    const getLabel = (key) => {
        if (!labelLookup) return key
        if (typeof labelLookup.get === 'function') {
            return labelLookup.get(key) || key
        }
        if (labelLookup instanceof Map) {
            return labelLookup.get(key) || key
        }
        return labelLookup[key] || key
    }

    UNION_FIELD_SPECS.forEach(({ key, kind }) => {
        const exists = descriptors.some(descriptor => getUnionFieldKind(descriptor.id) === kind)
        if (exists) return
        const label = getLabel(key)
        descriptors.push(createFieldDescriptor(key, key, label, buildPersonLabelFn))
    })

    return descriptors
}

export function createBaseFieldLabelStore() {
    const store = new Map(DISPLAY_FIELD_LABELS)
    EDITABLE_DEFAULTS.forEach(def => {
        store.set(normalizeFieldKey(def.value), def.label)
    })
    Object.values(DISPLAY_DEFAULTS).forEach(defs => {
        defs.forEach(def => {
            if (def.label) {
                store.set(normalizeFieldKey(def.value), def.label)
            }
        })
    })
    return store
}

export function buildFieldDescriptors(fields, labelStore = createBaseFieldLabelStore(), buildPersonLabelFn) {
    const store = labelStore || createBaseFieldLabelStore()
    const descriptors = sanitizeFieldValues(fields).map(value => {
        const key = normalizeFieldKey(value)
        const label = store.get(key) || value
        return createFieldDescriptor(key, value, label, buildPersonLabelFn)
    })
    return appendUnionFieldDescriptors(descriptors, store, buildPersonLabelFn)
}


export const DEFAULT_CHART_CONFIG = Object.freeze({
    transitionTime: 320,
    cardXSpacing: 240,
    cardYSpacing: 140,
    orientation: 'vertical',
    showSiblingsOfMain: true,
    singleParentEmptyCard: true,
    singleParentEmptyCardLabel: 'Inconnu',
    ancestryDepth: 4,
    progenyDepth: 4,
    miniTree: true,
    linkStyle: 'legacy',
    editableFields: [...DEFAULT_EDITABLE_FIELDS],
    cardDisplay: DEFAULT_CARD_DISPLAY.map(row => [...row]),
    mainId: null
})

export function normalizeCardDisplay(rows) {
    const safeRows = Array.isArray(rows) ? rows : []
    const normalized = safeRows.slice(0, 2).map(row => sanitizeFieldValues(Array.isArray(row) ? row : []))
    while (normalized.length < 2) normalized.push([])
    return normalized
}

export function cloneCardDisplay(cardDisplay, fallbackRows = DEFAULT_CARD_DISPLAY) {
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

export function buildChartConfig(overrides = {}) {
    const base = {
        transitionTime: DEFAULT_CHART_CONFIG.transitionTime,
        cardXSpacing: DEFAULT_CHART_CONFIG.cardXSpacing,
        cardYSpacing: DEFAULT_CHART_CONFIG.cardYSpacing,
        orientation: DEFAULT_CHART_CONFIG.orientation,
        showSiblingsOfMain: DEFAULT_CHART_CONFIG.showSiblingsOfMain,
        singleParentEmptyCard: DEFAULT_CHART_CONFIG.singleParentEmptyCard,
        singleParentEmptyCardLabel: DEFAULT_CHART_CONFIG.singleParentEmptyCardLabel,
        ancestryDepth: DEFAULT_CHART_CONFIG.ancestryDepth,
        progenyDepth: DEFAULT_CHART_CONFIG.progenyDepth,
        miniTree: DEFAULT_CHART_CONFIG.miniTree,
        linkStyle: DEFAULT_CHART_CONFIG.linkStyle,

        editableFields: [...DEFAULT_EDITABLE_FIELDS],
        cardDisplay: cloneCardDisplay(DEFAULT_CARD_DISPLAY),
        mainId: DEFAULT_CHART_CONFIG.mainId
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

    if (overrides.ancestryDepth === null) {
        base.ancestryDepth = null
    } else if (typeof overrides.ancestryDepth === 'number' && Number.isFinite(overrides.ancestryDepth) && overrides.ancestryDepth >= 0) {
        base.ancestryDepth = Math.floor(overrides.ancestryDepth)
    }

    if (overrides.progenyDepth === null) {
        base.progenyDepth = null
    } else if (typeof overrides.progenyDepth === 'number' && Number.isFinite(overrides.progenyDepth) && overrides.progenyDepth >= 0) {
        base.progenyDepth = Math.floor(overrides.progenyDepth)
    }

    if (typeof overrides.miniTree === 'boolean') {
        base.miniTree = overrides.miniTree
    }

    const rawLinkStyle = overrides.linkStyle ?? overrides.link_style
    if (rawLinkStyle === 'legacy' || rawLinkStyle === 'smooth') {
        base.linkStyle = rawLinkStyle
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

    if (typeof overrides.mainId === 'string') {
        const trimmed = overrides.mainId.trim()
        if (trimmed) base.mainId = trimmed
    }

    return base
}
