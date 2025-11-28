import { EditDatumFormCreator, NewRelFormCreator, SelectField, RelReferenceField, Field } from '../types/form'
import * as icons from './icons'
import fr from '../i18n/fr'
import { escapeHtml } from '../utils/escape'


export function getHtmlNew(form_creator: NewRelFormCreator) {
  return (` 
    <form id="familyForm" class="f3-form">
      ${closeBtn()}
      <h3 class="f3-form-title">${escapeHtml(form_creator.title)}</h3>

      ${fields(form_creator)}
      
      <div class="f3-form-buttons">
        <button type="button" class="f3-cancel-btn">${escapeHtml(fr.form.cancel)}</button>
        <button type="submit">${escapeHtml(fr.form.save)}</button>
      </div>

      ${form_creator.linkExistingRelative ? addLinkExistingRelative(form_creator) : ''}
    </form>
  `)
}

export function getHtmlEdit(form_creator: EditDatumFormCreator) {
  return (` 
    <form id="familyForm" class="f3-form ${form_creator.editable ? '' : 'non-editable'}">
      ${closeBtn()}
      
      <div class="tabs-nav" style="margin-top: 20px;">
        <button type="button" class="active" data-tab="details">Détails</button>
        <button type="button" data-tab="files">Fichiers</button>
      </div>

      <div class="tab-content active" data-tab-content="details">
        <div style="text-align: right; display: 'block'">
          ${!form_creator.no_edit ? addRelativeBtn(form_creator) : ''}
        </div>

        ${fields(form_creator)}
        
        <div class="f3-form-buttons">
          <button type="button" class="f3-cancel-btn">${escapeHtml(fr.form.cancel)}</button>
          <button type="submit">${escapeHtml(fr.form.save)}</button>
        </div>

        ${form_creator.linkExistingRelative ? addLinkExistingRelative(form_creator) : ''}

        <hr>
        ${deleteBtn(form_creator)}

        ${removeRelativeBtn(form_creator)}
      </div>

      <div class="tab-content" data-tab-content="files">
        <div class="f3-files-placeholder" style="padding: 1rem; text-align: center; color: #666;">
            <p>Documents liés à la personne (Bientôt disponible)</p>
        </div>
      </div>
    </form>
  `)
}

function deleteBtn(form_creator: EditDatumFormCreator) {
  return (`
    <div>
      <button type="button" class="f3-delete-btn" ${form_creator.can_delete ? '' : 'disabled'}>
        Supprimer
      </button>
    </div>
  `)
}

function removeRelativeBtn(form_creator: EditDatumFormCreator) {
  return (`
    <div>
      <button type="button" class="f3-remove-relative-btn${form_creator.removeRelativeActive ? ' active' : ''}">
        ${form_creator.removeRelativeActive ? 'Annuler la suppression du lien' : 'Supprimer le lien'}
      </button>
    </div>
  `)
}

function addRelativeBtn(form_creator: EditDatumFormCreator) {
  return (`
    <span class="f3-add-relative-btn">
      ${form_creator.addRelativeActive ? icons.userPlusCloseSvgIcon() : icons.userPlusSvgIcon()}
    </span>
  `)
}



function fields(form_creator: EditDatumFormCreator | NewRelFormCreator) {
  if (!form_creator.editable) return infoField()
  const unionFields = new Map<string, { relLabel: string; dateField?: RelReferenceField; placeField?: RelReferenceField }>()
  const orderedFields: (RelReferenceField | SelectField | Field)[] = []

  form_creator.fields.forEach(field => {
    if (isUnionReferenceField(field)) {
      const unionField = field as RelReferenceField
      const relId = unionField.rel_id
      if (!relId) return
      const bucket = unionFields.get(relId) || { relLabel: unionField.rel_label }
      const unionFieldType = getUnionFieldType(unionField.id)
      if (unionFieldType === 'date') bucket.dateField = unionField
      else if (unionFieldType === 'place') bucket.placeField = unionField
      else orderedFields.push(unionField)
      unionFields.set(relId, bucket)
      return
    }
    orderedFields.push(field)
  })

  const unionSectionHtml = renderUnionSection(unionFields)
  let unionInserted = false
  let fields_html = ''

  orderedFields.forEach(field => {
    fields_html += renderFormField(field)
  })

  if (!unionInserted && unionSectionHtml) {
    fields_html += unionSectionHtml
  }

  return fields_html

  function infoField() {
    let fields_html = ''
    form_creator.fields.forEach(field => {
      if (field.type === 'rel_reference') {
        const rf = field as RelReferenceField
        if (!rf.initial_value) return
        const relLabelSanitized = sanitizeRelLabel(rf.rel_label)
        fields_html += `
          <div class="f3-info-field">
            <span class="f3-info-field-label">${rf.label} - <i>${relLabelSanitized}</i></span>
            <span class="f3-info-field-value">${rf.initial_value || ''}</span>
          </div>`
      } else if (field.type === 'select') {
        const select_field = field as SelectField
        if (!field.initial_value) return
        fields_html += `
        <div class="f3-info-field">
          <span class="f3-info-field-label">${select_field.label}</span>
          <span class="f3-info-field-value">${select_field.options.find(option => option.value === select_field.initial_value)?.label || ''}</span>
        </div>`
      } else {
        fields_html += `
        <div class="f3-info-field">
          <span class="f3-info-field-label">${field.label}</span>
          <span class="f3-info-field-value">${field.initial_value || ''}</span>
        </div>`
      }
    })
    return fields_html
  }

  function isUnionReferenceField(field: unknown): field is RelReferenceField {
    if (!field || typeof field !== 'object') return false
    const candidate = field as Partial<RelReferenceField>
    if (candidate.type !== 'rel_reference' || typeof candidate.id !== 'string') return false
    return getUnionFieldType(candidate.id) !== null
  }

  function renderFormField(field: RelReferenceField | SelectField | Field) {
    if (field.type === 'text') {
      return `
      <div class="f3-form-field">
        <label>${field.label}</label>
        <input type="${field.type}" 
          name="${field.id}" 
          value="${escapeHtml(field.initial_value || '')}"
          placeholder="${escapeHtml(field.label)}">
      </div>`
    }
    if (field.type === 'textarea') {
      return `
      <div class="f3-form-field">
        <label>${field.label}</label>
        <textarea name="${field.id}" 
          placeholder="${escapeHtml(field.label)}">${escapeHtml(field.initial_value || '')}</textarea>
      </div>`
    }
    if (field.type === 'select') {
      const select_field = field as SelectField
      return `
      <div class="f3-form-field">
        <label>${select_field.label}</label>
        <select name="${select_field.id}" value="${select_field.initial_value || ''}">
          <option value="">${escapeHtml(select_field.placeholder || `Sélectionnez ${select_field.label}`)}</option>
          ${select_field.options.map((option) => `<option ${option.value === select_field.initial_value ? 'selected' : ''} value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('')}
        </select>
      </div>`
    }
    if (field.type === 'rel_reference') {
      const rf = field as RelReferenceField
      const relLabel = sanitizeRelLabel(rf.rel_label)
      return `
      <div class="f3-form-field">
        <label>${rf.label} - <i>${relLabel}</i></label>
        <input type="text" 
          name="${rf.id}" 
          value="${escapeHtml(rf.initial_value || '')}"
          placeholder="${escapeHtml(rf.label)}">
      </div>`
    }
    return ''
  }

  function renderUnionSection(collection: Map<string, { relLabel: string; dateField?: RelReferenceField; placeField?: RelReferenceField }>) {
    if (!collection || collection.size === 0) return ''
    let html = `
    <section class="f3-union-section">
      <h4 class="f3-union-title">${fr.union?.title ?? 'Unions et conjoints'}</h4>`
    let hasContent = false
    collection.forEach(bucket => {
      const heading = sanitizeRelLabel(bucket.relLabel || 'Conjoint')
      const dateField = bucket.dateField
      const placeField = bucket.placeField
      const dateHtml = renderUnionInput(dateField)
      const placeHtml = renderUnionInput(placeField)
      if (!dateHtml && !placeHtml) return
      hasContent = true
      html += `
      <div class="f3-union-entry">
        <p class="f3-union-entry-heading">${fr.union?.unionWith ?? 'Union avec'} <strong>${heading}</strong></p>
        <div class="f3-union-fields">
          ${dateHtml}
          ${placeHtml}
        </div>
      </div>`
    })
    html += `
    </section>`
    return hasContent ? html : ''
  }

  function renderUnionInput(field?: RelReferenceField) {
    if (!field) return ''
    return `
          <div class="f3-form-field f3-union-field">
            <label>${field.label}</label>
            <input type="text" 
              name="${field.id}" 
              value="${field.initial_value || ''}"
              placeholder="${field.label}">
          </div>`
  }

  function sanitizeRelLabel(label?: string) {
    if (!label) return ''
    const cleaned = label

      .replace(/\s*\([^)]*\)/g, ' ')

      .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, ' ')

      .replace(/\b\d{4}\b/g, ' ')

      .replace(/\s{2,}/g, ' ')
      .trim()
    return cleaned
  }
}

type UnionFieldType = 'date' | 'place'

function getUnionFieldType(fieldId: string): UnionFieldType | null {
  if (typeof fieldId !== 'string') return null
  const delimiterIndex = fieldId.indexOf('__ref__')
  if (delimiterIndex === -1) return null
  const prefix = fieldId.slice(0, delimiterIndex)
  const normalized = prefix
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim()
  const cleaned = normalized.replace(/[^a-z]+/g, '')
  if (cleaned === 'uniondate' || (normalized.startsWith('union') && normalized.includes('date'))) return 'date'
  if (cleaned === 'unionplace' || (normalized.startsWith('union') && normalized.includes('place'))) return 'place'
  return null
}

function addLinkExistingRelative(form_creator: EditDatumFormCreator | NewRelFormCreator) {
  const link = form_creator.linkExistingRelative!
  const title = link && Object.prototype.hasOwnProperty.call(link, 'title') ? link.title : 'Profil déjà présent ?'
  const select_placeholder = link && Object.prototype.hasOwnProperty.call(link, 'select_placeholder') ? link.select_placeholder : 'Sélectionnez un profil'
  const options = link ? (link.options as SelectField['options']) : []
  return (`
    <div>
      <hr>
      <div class="f3-link-existing-relative">
        <label>${title}</label>
        <select>
          <option value="">${select_placeholder}</option>
          ${options.map(option => `<option value="${option.value}">${option.label}</option>`).join('')}
        </select>
      </div>
    </div>
  `)
}


function closeBtn() {
  return (`
    <span class="f3-close-btn">
      ×
    </span>
  `)
}


