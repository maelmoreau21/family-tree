import { Data, Datum } from "../types/data"
import { normalizeDatumDateFields } from "../utils/date"

export interface LegacyDatum extends Omit<Datum, 'rels'> {
  rels: {
    father?: string;
    mother?: string;
    spouses?: string[];
    children?: string[];

    parents?: string[];
  };
}

export function formatData(data: Data | LegacyDatum[]) {
  data.forEach((d: LegacyDatum) => {
    if (!d.rels.parents) d.rels.parents = []
    if (!d.rels.spouses) d.rels.spouses = []
    if (!d.rels.children) d.rels.children = []

    convertFatherMotherToParents(d)
    normalizeDatumDateFields(d as unknown as Datum)
  })
  return data as Data

  function convertFatherMotherToParents(d:LegacyDatum) {
    if (!d.rels.parents) d.rels.parents = []
    if (d.rels.father) d.rels.parents.push(d.rels.father)
    if (d.rels.mother) d.rels.parents.push(d.rels.mother)
    delete d.rels.father
    delete d.rels.mother
  }
}

export function formatDataForExport(data: LegacyDatum[], legacy_format: boolean = false) {
  data.forEach(d => {
    if (legacy_format) {
      let father: Datum['id'] | undefined;
      let mother: Datum['id'] | undefined;
      d.rels.parents?.forEach(parentId => {
        const parent = data.find(candidate => candidate.id === parentId)
        if (!parent) throw new Error('Parent not found')

        const parentData = (typeof parent.data === 'object' && parent.data)
          ? parent.data as { gender?: unknown }
          : { gender: undefined }
        const gender = parentData.gender === 'M' || parentData.gender === 'F'
          ? parentData.gender
          : undefined

        if (gender === 'M') {
          if (!father) father = parent.id as Datum['id']
          else mother = parent.id as Datum['id']   // for same sex parents, set alternate parent to mother
        } else if (gender === 'F') {
          if (!mother) mother = parent.id as Datum['id']
          else father = parent.id as Datum['id']   // for same sex parents, set alternate parent to father
        }
      })
      if (father) d.rels.father = father
      if (mother) d.rels.mother = mother
  
      delete d.rels.parents
    }
    if (d.rels.parents && d.rels.parents.length === 0) delete d.rels.parents
    if (d.rels.spouses && d.rels.spouses.length === 0) delete d.rels.spouses
    if (d.rels.children && d.rels.children.length === 0) delete d.rels.children
    normalizeDatumDateFields(d as unknown as Datum)
  })
  return data
}