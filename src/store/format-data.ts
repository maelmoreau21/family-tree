import { Data, Datum } from "../types/data"

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
      d.rels.parents?.forEach(p => {
        const parent = data.find(d => d.id === p)
        if (!parent) throw new Error('Parent not found')
        if (parent.data.gender === "M") {
          if (!father) father = parent.id
          else mother = parent.id   // for same sex parents, we set some parent to father and some to mother
        }
        if (parent.data.gender === "F") {
          if (!mother) mother = parent.id
          else father = parent.id   // for same sex parents, we set some parent to father and some to mother
        }
      })
      if (father) d.rels.father = father
      if (mother) d.rels.mother = mother
  
      delete d.rels.parents
    }
    if (d.rels.parents && d.rels.parents.length === 0) delete d.rels.parents
    if (d.rels.spouses && d.rels.spouses.length === 0) delete d.rels.spouses
    if (d.rels.children && d.rels.children.length === 0) delete d.rels.children
  })
  return data
}