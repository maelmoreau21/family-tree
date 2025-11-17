import { Data, Datum } from "../types/data"
import {createNewPerson} from "./new-person"
import { normalizeDateValue, shouldNormalizeDateField } from "../utils/date"
import { stripOriginIfSame, looksLikeHttpUrl } from "../utils/url"

export function submitFormData(datum: Datum, data_stash: Data, form_data: FormData) {
  form_data.forEach((value, key) => {
    if (typeof value === "string" && shouldNormalizeDateField(key)) {
      datum.data[key] = normalizeDateValue(value)
    } else if (typeof value === 'string' && looksLikeHttpUrl(value)) {
      datum.data[key] = stripOriginIfSame(value)
    } else {
      datum.data[key] = value
    }
  })
  syncRelReference(datum, data_stash)
  if (datum.to_add) delete datum.to_add
  if (datum.unknown) delete datum.unknown
}

export function syncRelReference(datum: Datum, data_stash: Data) {
  Object.keys(datum.data).forEach(k => {
    if (k.includes('__ref__')) {
      const rel_id = k.split('__ref__')[1]
      const rel = data_stash.find(d => d.id === rel_id)
      if (!rel) return
      const ref_field_id = k.split('__ref__')[0]+'__ref__'+datum.id
      rel.data[ref_field_id] = datum.data[k]
    }
  })
}

export function onDeleteSyncRelReference(datum: Datum, data_stash: Data) {
  Object.keys(datum.data).forEach(k => {
    if (k.includes('__ref__')) {
      const rel_id = k.split('__ref__')[1]
      const rel = data_stash.find(d => d.id === rel_id)
      if (!rel) return
      const ref_field_id = k.split('__ref__')[0]+'__ref__'+datum.id
      delete rel.data[ref_field_id]
    }
  })
}

 

export function removeToAdd(datum: Datum, data_stash: Data) {
  deletePerson(datum, data_stash, false)
  return false
}

export function deletePerson(datum: Datum, data_stash: Data, clean_to_add: boolean = true) {
  executeDelete()
  if (clean_to_add) removeToAddFromData(data_stash)
  return { success: true }

  function executeDelete() {
    data_stash.forEach(d => {
      for (const k in d.rels) {
        if (!Object.prototype.hasOwnProperty.call(d.rels, k)) continue
        const key = k as keyof Datum['rels']
        const relList = d.rels[key]
        if (Array.isArray(relList)) {
          const idx = relList.indexOf(datum.id)
          if (idx !== -1) relList.splice(idx, 1)
        }
      }
    })

    onDeleteSyncRelReference(datum, data_stash)

    const index = data_stash.findIndex(d => d.id === datum.id)
    if (index !== -1) data_stash.splice(index, 1)

    if (data_stash.length === 0) {
      data_stash.push(createNewPerson({ data: { gender: 'M' } }))
    }
  }
}

export function cleanupDataJson(data: Data) {
  removeToAddFromData(data)
  data.forEach(d => {
    delete d.main
    delete d._tgdp
    delete d._tgdp_sp
    delete d.__tgdp_sp
  })
  data.forEach(d => {
    Object.keys(d).forEach(k => {
      if (k[0] === '_') console.error('key starts with _', k)
    })
  })
  return data
}

export function removeToAddFromData(data: Data) {
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].to_add) removeToAdd(data[i], data)
  }
}