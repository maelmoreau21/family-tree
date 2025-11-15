import { Data, Datum } from "../types/data"

type RelType = 'daughter' | 'son' | 'mother' | 'father' | 'spouse'

export function createNewPerson({data, rels}: {data: Datum['data'], rels?: {parents?: string[], spouses?: string[], children?: string[]}}) {
  return {
    id: generateUUID(),
    data: data || {},
    rels: {
      ...{parents: [], children: [], spouses: []},
      ...(rels || {})}
    }
}

export function addNewPerson({data_stash, datum}: {data_stash: Data, datum: Datum}) {
  data_stash.push(datum)
}

function generateUUID() {
  let d = new Date().getTime();
  let d2 = (performance && performance.now && (performance.now()*1000)) || 0;//Time in microseconds since page-load or 0 if unsupported
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    let r = Math.random() * 16;
    if(d > 0){//Use timestamp until depleted
      r = (d + r)%16 | 0;
      d = Math.floor(d/16);
    } else {//Use microseconds since page-load if supported
      r = (d2 + r)%16 | 0;
      d2 = Math.floor(d2/16);
    }
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
