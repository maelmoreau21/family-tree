import { getLinkRelOptions } from "../store/add-existing-rel"
import { submitFormData } from "../store/edit"
import { Data, Datum } from "../types/data"
import {
  FormCreatorSetupProps,
  FormCreator,
  BaseFormCreator,
  RelReferenceFieldCreator,
  SelectFieldCreator,
  RelReferenceField,
  SelectField
} from "../types/form"
import { formatPersonName } from "../utils/person"


export function formCreatorSetup({
  datum,
  store,
  fields,
  postSubmitHandler,
  addRelative,
  removeRelative,
  deletePerson,
  onCancel,
  editFirst,
  link_existing_rel_config,
  onFormCreation,
  no_edit,
  onSubmit,
  onDelete,
  canEdit,
  canDelete,
}: FormCreatorSetupProps) {
  let can_delete = canDelete ? canDelete(datum) : true
  const can_edit = canEdit ? canEdit(datum) : true
  if (!can_edit) {
    no_edit = true
    can_delete = false
  }
  let form_creator: FormCreator;
  const base_form_creator: BaseFormCreator = {
    datum_id: datum.id,
    fields: [],
    onSubmit: submitFormChanges,
    onCancel: onCancel,
    onFormCreation: onFormCreation,
    no_edit: no_edit,
  }

  // Existing datum form creator
  if (!datum._new_rel_data) {
    if (!addRelative) throw new Error('addRelative is required')
    if (!removeRelative) throw new Error('removeRelative is required')
    form_creator = {
      ...base_form_creator,
      onDelete: deletePersonWithPostSubmit,
      addRelative: () => addRelative.activate(datum),
      addRelativeCancel: () => addRelative.onCancel!(),
      addRelativeActive: addRelative.is_active,
      removeRelative: () => removeRelative.activate(datum),
      removeRelativeCancel: () => removeRelative.onCancel!(),
      removeRelativeActive: removeRelative.is_active,
      editable: false,
      can_delete: can_delete,
    }
  }

  // New rel form creator
  else {
    form_creator = {
      ...base_form_creator,
      title: datum._new_rel_data.label,
      new_rel: true,
      editable: true
    }
  }
  if (datum._new_rel_data || datum.to_add || datum.unknown) {
    if (link_existing_rel_config) form_creator.linkExistingRelative = createLinkExistingRelative(datum, store.getData(), link_existing_rel_config)
  }

  if (no_edit) form_creator.editable = false
  else if (editFirst) form_creator.editable = true

  const toInitialValue = (value: unknown) => {
    if (value === null || value === undefined) return ''
    return String(value)
  }

  type FieldInput = FormCreatorSetupProps['fields'][number]
  const getLabel = (field: FieldInput) => ('label' in field && field.label) ? field.label : field.id
  const getType = (field: FieldInput) => ('type' in field && field.type) ? field.type : 'text'

  fields.forEach(field => {
    if ('initial_value' in field) {
      form_creator.fields.push(field)
      return
    }

    const type = getType(field)
    const label = getLabel(field)

    if (type === 'rel_reference') {
      // Provide a safe fallback for getRelLabel so callers (including external
      // builder scripts) that forget to supply it don't break form creation.
      // allow previous code to accept external callables without enforcing strict typing
      const providedGetRelLabel = 'getRelLabel' in field && typeof field.getRelLabel === 'function'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (field as any).getRelLabel as (d: Datum) => string
        : undefined

      const defaultGetRelLabel = (d: Datum) => {
        try {
          if (d) return formatPersonName(d)
        } catch (e) {
          // ignore and fall through
        }
        return 'Profil sans nom'
      }

      const relField: RelReferenceFieldCreator = {
        id: field.id,
        type: 'rel_reference',
        label,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rel_type: 'rel_type' in field ? (field as any).rel_type : 'spouse',
        getRelLabel: providedGetRelLabel || defaultGetRelLabel,
      }
      if (!providedGetRelLabel) {
        // preserve the previous behavior of logging a helpful message
        console.warn('rel_reference field creator did not provide getRelLabel — using default')
      }
      addRelReferenceField(relField)
      return
    }

    if (type === 'select') {
      const selectCreator: SelectFieldCreator = {
        id: field.id,
        type: 'select',
        label,
        placeholder: 'placeholder' in field ? field.placeholder : undefined,
        options: 'options' in field ? field.options : undefined,
        optionCreator: 'optionCreator' in field ? field.optionCreator : undefined,
      }
      addSelectField(selectCreator)
      return
    }

    form_creator.fields.push({
      id: field.id,
      type,
      label,
      initial_value: toInitialValue(datum.data[field.id])
    })
  })

  return form_creator

  function addRelReferenceField(field: RelReferenceFieldCreator) {
    if (!field.getRelLabel) console.error('getRelLabel is not set')

    if (field.rel_type === 'spouse') {
      (datum.rels.spouses || []).forEach(spouse_id => {
        const spouse = store.getDatum(spouse_id)
        if (!spouse) throw new Error('Spouse not found')
        const marriage_date_id = `${field.id}__ref__${spouse_id}`
        const relLabel = formatPersonName(spouse)
        const rel_reference_field: RelReferenceField = {
          id: marriage_date_id,
          type: 'rel_reference',
          label: field.label,
          rel_id: spouse_id,
          rel_label: relLabel,
          initial_value: toInitialValue(datum.data[marriage_date_id]),
          rel_type: field.rel_type,
        }
        form_creator.fields.push(rel_reference_field)
      })
    }
  }

  function addSelectField(field: SelectFieldCreator) {
    if (!field.options && !field.optionCreator) return console.error('optionCreator or options is not set for field', field)
    const options = field.options || (field.optionCreator ? field.optionCreator(datum) : [])
    const select_field: SelectField = {
      id: field.id,
      type: field.type,
      label: field.label,
      initial_value: toInitialValue(datum.data[field.id]),
      placeholder: field.placeholder,
      options,
    }
    form_creator.fields.push(select_field)
  }

  function createLinkExistingRelative(datum: Datum, data: Data, link_existing_rel_config: FormCreatorSetupProps['link_existing_rel_config']) {
    if (!link_existing_rel_config) throw new Error('link_existing_rel_config is required')
    const obj = {
      title: link_existing_rel_config.title,
      select_placeholder: link_existing_rel_config.select_placeholder,
      options: getLinkRelOptions(datum, data)
        .map((d: Datum) => ({value: d.id, label: link_existing_rel_config.linkRelLabel(d)}))
        .sort((a: {label: string}, b: {label: string}) => {
          if (typeof a.label === 'string' && typeof b.label === 'string') return a.label.localeCompare(b.label)
          else return a.label < b.label ? -1 : 1
        }),
      onSelect: submitLinkExistingRelative
    }
    return obj
  }

  function submitFormChanges(e: Event) {
    if (onSubmit) {
      onSubmit(e, datum, applyChanges, () => postSubmitHandler({}))
    } else {
      e.preventDefault()
      applyChanges()
      postSubmitHandler({})
    }

    function applyChanges() {
      const form_data = new FormData(e.target as HTMLFormElement)
      submitFormData(datum, store.getData(), form_data)
    }
  }

  function submitLinkExistingRelative(e: Event) {
    const link_rel_id = (e.target as HTMLSelectElement).value
    postSubmitHandler({link_rel_id: link_rel_id})
  }

  function deletePersonWithPostSubmit() {
    if (onDelete) {
      onDelete(datum, () => deletePerson!(), () => postSubmitHandler({delete: true}))
    } else {
      deletePerson!()
      postSubmitHandler({delete: true})
    }
  }
}