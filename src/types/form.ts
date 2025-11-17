import { Datum } from "./data"
import { Store } from "./store"

import { AddRelative } from "../core/add-relative"
import { RemoveRelative } from "../core/remove-relative"
import { EditTree } from "../core/edit"


export interface LinkExistingRelative {
  title?: string;
  select_placeholder?: string;
  options: {value: string; label: string}[];
  onSelect: (e: Event) => void;
}

export interface FormCreatorSetupProps {
  datum: Datum
  store: Store
  fields: Array<Field | RelReferenceFieldCreator | SelectFieldCreator | {id: string; type?: string; label?: string}>
  fields: Array<Field | RelReferenceFieldCreator | SelectFieldCreator | {id: string; type?: string; label?: string}>
  postSubmitHandler: (props?: Record<string, unknown>) => void
  onCancel: () => void
  editFirst: boolean
  no_edit: boolean
  link_existing_rel_config?: {linkRelLabel: (d: Datum) => string, title?: string, select_placeholder?: string}
  onFormCreation: EditTree['onFormCreation']
  addRelative?: AddRelative
  removeRelative?: RemoveRelative
  deletePerson?: () => void
  onSubmit?: (e: Event, datum: Datum, applyChanges: () => void, postSubmit: () => void) => void
  onDelete?: (datum: Datum, deletePerson: () => void, postSubmit: (props?: Record<string, unknown>) => void) => void
  canEdit?: (datum: Datum) => boolean
  canDelete?: (datum: Datum) => boolean
}

export interface BaseFormCreator {
  datum_id: string;
  fields: Field[];
  onSubmit: (e: Event) => void;
  onCancel: () => void;
  onFormCreation: FormCreatorSetupProps['onFormCreation']
  no_edit: boolean;
  linkExistingRelative?: LinkExistingRelative;
}

export interface EditDatumFormCreator extends BaseFormCreator {
  onDelete: () => void;
  addRelative: () => void;
  addRelativeCancel: () => void;
  addRelativeActive: boolean;
  removeRelative: () => void;
  removeRelativeCancel: () => void;
  removeRelativeActive: boolean;
  editable: boolean;
  can_delete: boolean;
}

export interface NewRelFormCreator extends BaseFormCreator {
  title: string;
  new_rel: boolean;
  editable: boolean;
}

export type FormCreator = EditDatumFormCreator | NewRelFormCreator;

export interface Field {
  id: string;
  type: string;
  label: string;
  initial_value: string;
  placeholder?: string;
}

export interface RelReferenceField extends Field {
  type: 'rel_reference';
  rel_id: string;
  rel_label: string;
  rel_type: 'spouse';
}

export interface RelReferenceFieldCreator {
  type?: 'rel_reference';
  rel_type: 'spouse';
  id: string;
  label: string;
  getRelLabel: (datum: Datum) => string;
}

export interface SelectField extends Field {
  type: 'select';
  options: {value: string; label: string}[];
}

export interface SelectFieldCreator {
  id: string;
  type: 'select';
  label: string;
  placeholder?: string;
  options?: {value: string; label: string}[];
  optionCreator?: (datum: Datum) => {value: string; label: string}[];
}
