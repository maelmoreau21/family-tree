export interface Datum {
  id: string;
  data: {
    gender: 'M' | 'F';
    [key: string]: any;
  };
  rels: {
    parents: string[];
    spouses: string[];
    children: string[];
  };
  [key: string]: any;
}

export type Data = Datum[];