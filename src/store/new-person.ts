import { Datum } from "../types/data"

export function createNewPerson({data, rels}: {data: Datum['data'], rels?: {parents?: string[], spouses?: string[], children?: string[]}}) {
  return {
    id: generateUUID(),
    data: data || {},
    rels: {
      ...{parents: [], children: [], spouses: []},
      ...(rels || {})}
    }
}

// addNewPerson was an internal helper previously exported, but it's not used anywhere
// and can be removed safely to reduce dead code surface.

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
