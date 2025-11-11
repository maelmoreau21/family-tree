import * as d3 from "d3"
import { TreeDatum } from "../types/treeData"
import { Store } from "../types/store"
import { Datum } from "../types/data"
import { Modal } from "../features/modal"

export default (
  store: RemoveRelative['store'],
  onActivate: RemoveRelative['onActivate'],
  cancelCallback: RemoveRelative['cancelCallback'],
  modal: RemoveRelative['modal'],
) => { return new RemoveRelative(store, onActivate, cancelCallback, modal) }

export class RemoveRelative {
  store: Store
  onActivate: () => void
  cancelCallback: (datum: Datum) => void
  modal: Modal
  datum: Datum | null
  onChange: ((rel_tree_datum: TreeDatum, onAccept: () => void) => void) | null
  onCancel: (() => void) | null
  is_active: boolean

  constructor(
    store: RemoveRelative['store'],
    onActivate: RemoveRelative['onActivate'],
    cancelCallback: RemoveRelative['cancelCallback'],
    modal: RemoveRelative['modal'],
  ) {
    this.store = store
  
    this.onActivate = onActivate
    this.cancelCallback = cancelCallback
    this.modal = modal
  
    this.datum = null
  
    this.onChange = null
    this.onCancel = null
  
    this.is_active = false
  
    return this
  }


  activate(datum: Datum) {
    if (this.is_active) this.onCancel!()
    this.onActivate()
    this.is_active = true
    this.store.state.one_level_rels = true
  
    const store = this.store
    store.updateTree({})

    this.datum = datum  
    this.onChange = onChange.bind(this)
    this.onCancel = onCancel.bind(this)

  
    function onChange(this: RemoveRelative, rel_tree_datum: TreeDatum, onAccept: () => void) {
      const rel_type = findRelType(rel_tree_datum)
  
      const rels = datum.rels
      if (rel_type === 'parent') handleParentRemoval.call(this)
      else if (rel_type === 'spouse') handleSpouseRemoval.call(this)
      else if (rel_type === 'children') handleChildrenRemoval.call(this)
  
      function handleParentRemoval() {
        const rel_id = rel_tree_datum.data.id
        const parent = store.getDatum(rel_id)
        if (!parent) throw new Error('Parent not found')
        if (!parent.rels.children) throw new Error('Parent has no children')
        parent.rels.children = parent.rels.children.filter(id => id !== datum.id)
        rels.parents = rels.parents.filter(id => id !== rel_id)
        onAccept()
      }
  
      function handleSpouseRemoval(this: RemoveRelative) {
        const spouse = rel_tree_datum.data
        if (checkIfChildrenWithSpouse()) openModal.call(this)
        else remove.call(this, true)
        
        function checkIfChildrenWithSpouse() {
          const children = spouse.rels.children || []
          return children.some(ch_id => {
            const child = store.getDatum(ch_id)
            if (!child) throw new Error('Child not found')
            if (child.rels.parents.includes(spouse.id)) return true
            return false
          })
        }
  
        function openModal(this: RemoveRelative) {
          const current_gender_class = datum.data.gender === 'M' ? 'f3-male-bg' : datum.data.gender === 'F' ? 'f3-female-bg' : null
          const spouse_gender_class = spouse.data.gender === 'M' ? 'f3-male-bg' : spouse.data.gender === 'F' ? 'f3-female-bg' : null
    
          const div = d3.create('div').html(`
            <p>Vous supprimez un lien de conjoint. Comme des enfants sont partagés, choisissez quel parent doit les conserver dans l'arbre.</p>
            <div class="f3-modal-options">
              <button data-option="assign-to-current" class="f3-btn ${current_gender_class}">Garder les enfants avec la personne actuelle</button>
              <button data-option="assign-to-spouse" class="f3-btn ${spouse_gender_class}">Garder les enfants avec le conjoint</button>
            </div>
          `)
    
          div.selectAll('[data-option="assign-to-current"]').on('click', () => {
            remove(true)
            this.modal.close()
          })
    
          div.selectAll('[data-option="assign-to-spouse"]').on('click', () => {
            remove(false)
            this.modal.close()
          })
    
          this.modal.activate(div.node()!)
        }
        
        function remove(to_current: boolean) {
          rel_tree_datum.data.rels.spouses = rel_tree_datum.data.rels.spouses!.filter(id => id !== datum.id)
          rels.spouses = rels.spouses!.filter(id => id !== rel_tree_datum.data.id);
          const childrens_parent = to_current ? datum : rel_tree_datum.data
          const other_parent = to_current ? rel_tree_datum.data : datum;
          (rels.children || []).forEach(id => {
            const child = store.getDatum(id)
            if (!child) throw new Error('Child not found')
            if (child.rels.parents.includes(other_parent.id)) child.rels.parents = child.rels.parents.filter(id => id !== other_parent.id)
          })
          if (other_parent.rels.children) {
            other_parent.rels.children = other_parent.rels.children.filter(ch_id => !(childrens_parent.rels.children || []).includes(ch_id))
          }
          onAccept()
        }
      }
  
      function handleChildrenRemoval() {
        if (!rels.children) throw new Error('Children not found')
        rels.children = rels.children.filter(id => id !== rel_tree_datum.data.id)
        rel_tree_datum.data.rels.parents = rel_tree_datum.data.rels.parents.filter(id => id !== datum.id)
        onAccept()
      }
  
      function findRelType(d: TreeDatum) {
        if (d.is_ancestry) {
          if (datum.rels.parents.includes(d.data.id)) return 'parent'
        } 
        else if (d.spouse) {
          if (!datum.rels.spouses) throw new Error('Spouses not found')
          if (datum.rels.spouses.includes(d.data.id)) return 'spouse'
        }
        else {
          if (!datum.rels.children) throw new Error('Children not found')
          if (datum.rels.children.includes(d.data.id)) return 'children'
        }
        return null
      }
    }
  
    function onCancel(this: RemoveRelative) {
      if (!this.is_active) return
      this.is_active = false
      this.store.state.one_level_rels = false
  
      if (!this.datum) throw new Error('Datum not found')
      this.cancelCallback(this.datum)
  
      this.datum = null
      this.onChange = null
      this.onCancel = null
    }
  
  }
}