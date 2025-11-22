import * as d3 from "d3"
import { formCreatorSetup } from "./form-creator"
import { createHistory, createHistoryControls, HistoryWithControls } from "../features/history"
import { createFormEdit, createFormNew } from "../renderers/create-form"
import addRelative from "./add-relative"
import { deletePerson, cleanupDataJson } from "../store/edit"
import { handleLinkRel } from "../store/add-existing-rel"
import removeRelative, { RemoveRelative } from "./remove-relative"
import modal, { Modal } from "../features/modal"
import { clearElement } from "../utils/safe-html"

import { Store } from "../types/store"
import { Data, Datum } from "../types/data"
import { TreeDatum } from "../types/treeData"
import { AddRelative } from "./add-relative"
import { EditDatumFormCreator, FormCreator, FormCreatorSetupProps, NewRelFormCreator, RelReferenceFieldCreator, SelectFieldCreator } from "../types/form"
import { CardHtml } from "./cards/card-html"
import { CardSvg } from "./cards/card-svg"
import { LegacyDatum, formatDataForExport } from "../store/format-data"

type Card = CardHtml | CardSvg


const FIELD_LABEL_MAP: Record<string, string> = {
  'first name': 'Prénom',
  'first names': 'Prénoms',
  'last name': 'Nom',
  'maiden name': 'Nom de naissance',
  'birthday': 'Date de naissance',
  'death': 'Date de décès',
  'gender': 'Genre',
  'birthplace': 'Lieu de naissance',
  'deathplace': 'Lieu de décès',
  'bio': 'Biographie',
  'metiers': 'Métiers',
  'nationality': 'Nationalité',
  'occupation': 'Profession',
  'avatar': 'Avatar',
  'union paragraph': 'Paragraphe d’union'
}


export default (cont: HTMLElement, store: Store) => new EditTree(cont, store)
export class EditTree {
  cont: HTMLElement
  store: Store
  
  fields: Array<{type?: string; label?: string; id: string} | RelReferenceFieldCreator | SelectFieldCreator>
  formCont: {
    el?: HTMLElement,
    populate: (form_element: HTMLElement) => void,
    open: () => void,
    close: () => void,
  }
  is_fixed: boolean
  no_edit: boolean
  onChange: (() => void) | null
  editFirst: boolean
  postSubmit: ((datum: Datum, data: Data) => void) | null
  link_existing_rel_config?: FormCreatorSetupProps['link_existing_rel_config']
  onFormCreation: null | ((props: {cont: HTMLElement, form_creator: FormCreator}) => void)

  addRelativeInstance: AddRelative
  removeRelativeInstance: RemoveRelative
  history: HistoryWithControls | null
  modal: Modal

  createFormEdit: ((form_creator: FormCreator, closeCallback: () => void) => HTMLElement) | null
  createFormNew: ((form_creator: FormCreator, closeCallback: () => void) => HTMLElement) | null

  onSubmit: FormCreatorSetupProps['onSubmit']
  onDelete: FormCreatorSetupProps['onDelete']
  canEdit: FormCreatorSetupProps['canEdit']
  canDelete: FormCreatorSetupProps['canDelete']
  
  constructor(cont: HTMLElement, store: Store) {
    this.cont = cont
    this.store = store
  
    this.fields = [
      {type: 'text', label: 'Prénom', id: 'first name'},
      {type: 'text', label: 'Prénoms', id: 'first names'},
      {type: 'text', label: 'Nom', id: 'last name'},
      {type: 'text', label: 'Date de naissance', id: 'birthday'},
      {type: 'text', label: 'Avatar', id: 'avatar'}
    ]
  
    this.is_fixed = true
  
    this.no_edit = false
  
    this.onChange = null
  
    this.editFirst = false
  
    this.postSubmit = null
    
    this.onFormCreation = null
    
    this.createFormEdit = null
    this.createFormNew = null
  
    this.formCont = this.getFormContDefault()
    this.modal = this.setupModal()
    this.addRelativeInstance = this.setupAddRelative()
    this.removeRelativeInstance = this.setupRemoveRelative()
    this.history = this.createHistory()
  
    return this 
  }

  open(datum: Datum) {
    if (!datum.rels) datum = datum.data as unknown as Datum  // if TreeDatum is used, it will be converted to Datum. will be removed in a future version.
    const handleAddRelative = (self: EditTree) => {
      if (datum._new_rel_data) {
        self.cardEditForm(datum)
      } else {
        self.addRelativeInstance.onCancel!()
        self.cardEditForm(datum)
        self.store.updateMainId(datum.id)
        self.store.updateTree({})
      }
    }

    const handleRemoveRelative = (self: EditTree, tree_datum: TreeDatum | undefined) => {
      if (!tree_datum) throw new Error('Tree datum not found')
      if (!self.removeRelativeInstance.datum) throw new Error('Remove relative datum not found')
      if (!self.removeRelativeInstance.onCancel) throw new Error('Remove relative onCancel not found')
      if (!self.removeRelativeInstance.onChange) throw new Error('Remove relative onChange not found')

      if (datum.id === self.removeRelativeInstance.datum.id) {
        self.removeRelativeInstance.onCancel()
        self.cardEditForm(datum)
      } else {
        const onAccept = () => {
          self.removeRelativeInstance.onCancel!()
          self.updateHistory()
          self.store.updateTree({})
        }
        self.removeRelativeInstance.onChange(tree_datum, onAccept.bind(self))
      }
    }

    if (this.addRelativeInstance.is_active) handleAddRelative(this)
    else if (this.removeRelativeInstance.is_active) handleRemoveRelative(this, this.store.getTreeDatum(datum.id))
    else {
      this.cardEditForm(datum)
    }
  }

  private setupAddRelative() {
    const onActivate = (self: EditTree) => {
      if (self.removeRelativeInstance.is_active) self.removeRelativeInstance.onCancel!()
    }

    const cancelCallback = (self: EditTree, datum: Datum) => {
      self.store.updateMainId(datum.id)
      self.store.updateTree({})
      self.openFormWithId(datum.id)
    }

    return addRelative(this.store, () => onActivate(this), (datum: Datum) => cancelCallback(this, datum))
  }
  
  private setupRemoveRelative() {
    const setClass = (cont: HTMLElement, add: boolean) => {
      d3.select(cont).select('#f3Canvas').classed('f3-remove-relative-active', add)
    }

    const onActivate = function(this: EditTree) {
      if (this.addRelativeInstance.is_active) this.addRelativeInstance.onCancel!()
      setClass(this.cont, true)
    }

    const cancelCallback = function(this: EditTree, datum: Datum) {
      setClass(this.cont, false)
      this.store.updateMainId(datum.id)
      this.store.updateTree({})
      this.openFormWithId(datum.id)
    }

    return removeRelative(this.store, onActivate.bind(this), cancelCallback.bind(this), this.modal)
  }

  private createHistory() {
    const historyUpdateTree = function(this: EditTree) {
      if (this.addRelativeInstance.is_active) this.addRelativeInstance.onCancel!()
      if (this.removeRelativeInstance.is_active) this.removeRelativeInstance.onCancel!()
      this.store.updateTree({initial: false})
  this.history?.controls.updateButtons()
      this.openFormWithId(this.store.getMainDatum()?.id)
      if (this.onChange) this.onChange()
    }

    const history = createHistory(this.store, this._getStoreDataCopy.bind(this), historyUpdateTree.bind(this))

    const nav_cont = this.cont.querySelector('.f3-nav-cont') as HTMLElement
    if (!nav_cont) throw new Error("Nav cont not found")
    const controls = createHistoryControls(nav_cont, history)

    history.changed()
    controls.updateButtons()

    return {...history, controls}
  }
  
  openWithoutRelCancel(datum: Datum) {
    this.cardEditForm(datum)
  }

  private getFormContDefault() {
    let form_cont = d3.select(this.cont).select('div.f3-form-cont').node() as HTMLElement
    if (!form_cont) form_cont = d3.select(this.cont).append('div').classed('f3-form-cont', true).node()!

    return {
      el: form_cont,
      populate(form_element: HTMLElement) {
        clearElement(form_cont)
        form_cont.appendChild(form_element)
      },
      open() {
        d3.select(form_cont).classed('opened', true)
      },
      close() {
        d3.select(form_cont).classed('opened', false)
        clearElement(form_cont)
      },
    }
  }

  setFormCont(formCont: EditTree['formCont']) {
    this.formCont = formCont
    return this
  }
  
  cardEditForm(datum: Datum) {
    const props: {
      onCancel?: () => void,
      addRelative?: AddRelative,
      removeRelative?: RemoveRelative,
      deletePerson?: () => void,
    } = {}
    const is_new_rel = datum?._new_rel_data
    if (is_new_rel) {
      props.onCancel = () => this.addRelativeInstance.onCancel!()
    } else {
      props.addRelative = this.addRelativeInstance
      props.removeRelative = this.removeRelativeInstance
      props.deletePerson = () => {
        deletePerson(datum, this.store.getData())
        this.openFormWithId(this.store.getLastAvailableMainDatum().id)
  
        this.store.updateTree({})
      }
    }
  
    const postSubmitHandler = (self: EditTree, props?: Record<string, unknown>) => {
      if (self.addRelativeInstance.is_active) {
        self.addRelativeInstance.onChange!(datum, props)
        if (self.postSubmit) self.postSubmit(datum, self.store.getData())
        const active_datum = self.addRelativeInstance.datum
        if (!active_datum) throw new Error('Active datum not found')
        self.store.updateMainId(active_datum.id)
        self.openWithoutRelCancel(active_datum)
      } else if ((datum.to_add || datum.unknown) && typeof props?.link_rel_id === 'string') {
        const linkRelId = props.link_rel_id as string
        handleLinkRel(datum, linkRelId, self.store.getData())
        self.store.updateMainId(linkRelId)
        self.openFormWithId(linkRelId)
      } else if (!props?.delete) {
        if (self.postSubmit) self.postSubmit(datum, self.store.getData())
        self.openFormWithId(datum.id)
      }

      if (!self.is_fixed) self.closeForm()
      
      self.store.updateTree({})

      self.updateHistory()
    }

    const form_creator = formCreatorSetup({
      store: this.store, 
      datum, 
      postSubmitHandler: (props?: Record<string, unknown>) => postSubmitHandler(this, props),
      fields: this.fields, 
      onCancel: () => {},
      editFirst: this.editFirst,
      no_edit: this.no_edit,
      link_existing_rel_config: this.link_existing_rel_config,
      onFormCreation: this.onFormCreation,
      onSubmit: this.onSubmit,
      onDelete: this.onDelete,
      canEdit: this.canEdit,
      canDelete: this.canDelete,
      ...props
    })
  
    const form_cont = is_new_rel
      ? (this.createFormNew || createFormNew)(form_creator as NewRelFormCreator, this.closeForm.bind(this))
      : (this.createFormEdit || createFormEdit)(form_creator as EditDatumFormCreator, this.closeForm.bind(this))
  
    this.formCont.populate(form_cont)
  
    this.openForm()
  
  
  }
  
  openForm() {
    this.formCont.open()
  }
  
  closeForm() {
    this.formCont.close()
    this.store.updateTree({})
  }
  
  fixed() {
    this.is_fixed = true
    if (this.formCont.el) d3.select(this.formCont.el).style('position', 'relative')
  
    return this
  }
  
  absolute() {
    this.is_fixed = false
    if (this.formCont.el) d3.select(this.formCont.el).style('position', 'absolute')
  
    return this
  }
  
  setCardClickOpen(card: Card) {
    card.setOnCardClick((event: Event, d: TreeDatum) => {
      const mouseEvent = event as MouseEvent
      if (this.isAddingRelative()) {
        this.open(d.data)
      } else if (this.isRemovingRelative()) {
        this.open(d.data)
      } else {
        this.open(d.data)
        card.onCardClickDefault(mouseEvent, d)
      }
    })
  
    return this
  }
  
  openFormWithId(d_id: Datum['id']) {
    if (d_id) {
      const d = this.store.getDatum(d_id)
      if (!d) throw new Error('Datum not found')
      this.openWithoutRelCancel(d)
    } else {
      const d = this.store.getMainDatum()!
      if (!d) throw new Error('Main datum not found')
      this.openWithoutRelCancel(d)
    }
  }
  
  setNoEdit() {
    this.no_edit = true
  
    return this
  }
  
  setEdit() {
    this.no_edit = false
  
    return this
  }
  
  setFields(fields: Array<string | {id: string; label?: string; type?: string} | RelReferenceFieldCreator | SelectFieldCreator>) {  // todo: Field[]
    const new_fields: Array<{type?: string; label?: string; id: string} | RelReferenceFieldCreator | SelectFieldCreator> = []
    if (!Array.isArray(fields)) {
      console.error('fields must be an array')
      return this
    }
    for (const field of fields) {
      if (typeof field === 'string') {
        const id = field
        const label = FIELD_LABEL_MAP[id] || field
  new_fields.push({type: 'text', label, id})
      } else if (typeof field === 'object' && field !== null) {
          if (!('id' in field) || typeof field.id !== 'string' || !field.id) {
            console.error('fields must be an array of objects with id property')
          } else {
            // Preserve RelReferenceFieldCreator and SelectFieldCreator with extra properties
            const asAny = field as any
            if (Object.prototype.hasOwnProperty.call(asAny, 'getRelLabel') ||
                Object.prototype.hasOwnProperty.call(asAny, 'options') ||
                Object.prototype.hasOwnProperty.call(asAny, 'optionCreator')) {
              new_fields.push(asAny)
            } else {
              const fld = field as {id: string; label?: string; type?: string}
              const label = fld.label || FIELD_LABEL_MAP[fld.id] || fld.id
              const type = fld.type || 'text'
              new_fields.push({id: fld.id, label, type})
            }
          }
      } else {
        console.error('fields must be an array of strings or objects')
      }
    }
    this.fields = new_fields
  
    return this
  }
  
  setOnChange(fn: EditTree['onChange']) {
    this.onChange = fn
  
    return this
  }

  setCanEdit(canEdit: EditTree['canEdit']) {
    this.canEdit = canEdit
    return this
  }

  setCanDelete(canDelete: EditTree['canDelete']) {
    this.canDelete = canDelete
    return this
  }

  setCanAdd(canAdd: AddRelative['canAdd']) {
    this.addRelativeInstance.setCanAdd(canAdd)
    return this
  }
  
  addRelative(datum: Datum | undefined) {
    if (!datum) datum = this.store.getMainDatum()!
    this.addRelativeInstance.activate(datum)
  
    return this
  
  }
  
  setupModal() {
    return modal(this.cont)
  }
  
  setEditFirst(editFirst: EditTree['editFirst']) {
    this.editFirst = editFirst
  
    return this
  }
  
  isAddingRelative() {
    return this.addRelativeInstance.is_active
  }
  
  isRemovingRelative() {
    return this.removeRelativeInstance.is_active
  }
  
  setAddRelLabels(add_rel_labels: AddRelative['addRelLabels']) {
    this.addRelativeInstance.setAddRelLabels(add_rel_labels)
    return this
  }
  
  setLinkExistingRelConfig(link_existing_rel_config: EditTree['link_existing_rel_config']) {
    this.link_existing_rel_config = link_existing_rel_config
    return this
  }
  
  setOnFormCreation(onFormCreation: EditTree['onFormCreation']) {
    this.onFormCreation = onFormCreation
  
    return this
  }
  
  setCreateFormEdit(createFormEdit: EditTree['createFormEdit']) {
    this.createFormEdit = createFormEdit
    return this
  }
  
  setCreateFormNew(createFormNew: EditTree['createFormNew']) {
    this.createFormNew = createFormNew
    return this
  }
  
  private _getStoreDataCopy() {
    let data = JSON.parse(JSON.stringify(this.store.getData()))  // important to make a deep copy of the data
    if (this.addRelativeInstance.is_active) data = this.addRelativeInstance.cleanUp(data)    
    data = cleanupDataJson(data)
    return data
  }

  getStoreDataCopy() {
    return this.exportData()
  }


  exportData() {
    let data = this._getStoreDataCopy()
    data = formatDataForExport(data, this.store.state.legacy_format)
    return data as Data | LegacyDatum[]
  }
  
  getDataJson() {
    return JSON.stringify(this.exportData(), null, 2)
  }
  
  updateHistory() {
    const history = this.history
    if (history) {
      history.changed()
      history.controls.updateButtons()
    }
  
    if (this.onChange) this.onChange()
  }
  
  setPostSubmit(postSubmit: EditTree['postSubmit']) {
    this.postSubmit = postSubmit
  
    return this
  }
  
  setOnSubmit(onSubmit: EditTree['onSubmit']) {
    this.onSubmit = onSubmit
    return this
  }
  
  setOnDelete(onDelete: EditTree['onDelete']) {
    this.onDelete = onDelete
    return this
  }
  
  destroy() {
    if (this.history) {
      this.history.controls.destroy()
      this.history = null
    }
    if (this.formCont.el) d3.select(this.formCont.el).remove()
    if (this.addRelativeInstance.onCancel) this.addRelativeInstance.onCancel()
    this.store.updateTree({})
  
    return this
  }
}