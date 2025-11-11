export interface NewRelData {
  rel_type: 'father' | 'mother' | 'spouse' | 'son' | 'daughter'
  label: string
  rel_id: string
  other_parent_id?: string
}

export interface Datum {
  id: string;
  data: {
    gender: 'M' | 'F';
    [key: string]: unknown;
  };
  rels: {
    parents: string[];
    spouses: string[];
    children: string[];
  };
  to_add?: boolean;
  unknown?: boolean;
  _new_rel_data?: NewRelData;
  [key: string]: unknown;
}

export type Data = Datum[];