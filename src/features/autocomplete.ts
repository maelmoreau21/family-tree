import * as d3 from "d3"
import {personSvgIcon, chevronDownSvgIcon, linkOffSvgIcon} from "../renderers/icons"
import { checkIfConnectedToFirstPerson } from "../handlers/check-person-connection"
import { Datum } from "../types/data"
import { escapeHtml } from "../utils/escape"

export default function(cont: Autocomplete['cont'], onSelect: Autocomplete['onSelect'], config: Autocomplete['config'] = {}) { return new Autocomplete(cont, onSelect, config) }

interface AutocompleteOption {
  label: string
  value: string
  optionHtml: (d: AutocompleteOption) => string
  label_html?: string
  class?: string
  searchText?: string
}

class Autocomplete {
  cont: HTMLElement
  autocomplete_cont: HTMLElement
  options: AutocompleteOption[]
  onSelect: (value: string) => void
  config?: {
    placeholder?: string
  }
  getOptions?: () => Autocomplete['options']

  constructor(cont: HTMLElement, onSelect: (value: string) => void, config: {
    placeholder?: string
  } = {}) {
    this.cont = cont
    this.options = []
    this.onSelect = onSelect
    this.config = config
    this.autocomplete_cont = d3.select(this.cont).append('div').attr('class', 'f3-autocomplete-cont').node() as HTMLElement
    this.create()
  }

  create() {
    const containerSelection = d3.select<HTMLElement, undefined>(this.autocomplete_cont)
    containerSelection.selectAll('*').remove()

    const search_cont = containerSelection.append('div').attr('class', 'f3-autocomplete')
    const search_input_cont = search_cont.append('div').attr('class', 'f3-autocomplete-input-cont')
    const search_input = search_input_cont.append('input')
      .attr('type', 'text')
      .attr('placeholder', this.config?.placeholder || 'Rechercher')

    search_input_cont.append('span')
      .attr('class', 'f3-autocomplete-toggle')
      .html(chevronDownSvgIcon())

    const dropdown = search_cont.append('div')
      .attr('class', 'f3-autocomplete-items')
      .attr('tabindex', 0)

    const selectItem = (items: HTMLElement[], index: number) => {
      items.forEach(item => d3.select(item).classed("f3-selected", false))
      if (items[index]) {
        d3.select(items[index]).classed("f3-selected", true)
        items[index].scrollIntoView({ block: "nearest" })
      }
    }

    const updateDropdown = (filteredOptions: Autocomplete['options']) => {
      const items = dropdown
        .selectAll<HTMLDivElement, AutocompleteOption>('div.f3-autocomplete-item')
        .data(filteredOptions, option => option.value)

      const merged = items
        .join('div')
        .attr('class', 'f3-autocomplete-item')

      merged
        .on('click', (_event: MouseEvent, option: AutocompleteOption) => {
          this.onSelect(option.value)
        })
        .each(function(option: AutocompleteOption) {
          const node = this as HTMLElement
          node.innerHTML = ''
          if (option.optionHtml) {
            node.innerHTML = option.optionHtml(option)
          } else {
            const wrapper = document.createElement('div')
            if (option.class) wrapper.className = option.class
            wrapper.innerHTML = option.label_html || escapeHtml(option.label)
            node.appendChild(wrapper)
          }
        })
    }

    const closeDropdown = () => {
      search_cont.classed("active", false)
      updateDropdown([])
    }

    const updateOptions = () => {
      this.options = this.getOptions!()
    }

    const activateDropdown = () => {
      search_cont.classed("active", true)
      const searchInputValue = (search_input.property("value") || "") as string
      const normalizedQuery = searchInputValue.trim().toLowerCase()
      const filteredOptions = this.options.filter(option => {
        if (!normalizedQuery) return true
        const target = (option.searchText || option.label || "").toLowerCase()
        return target.includes(normalizedQuery)
      })

      filteredOptions.forEach(option => {
        option.label_html = buildHighlightedLabel(option.label, normalizedQuery)
      })

      filteredOptions.sort((a, b) => a.label.localeCompare(b.label))
      updateDropdown(filteredOptions)
    }

    const handleArrowKeys = (event: KeyboardEvent) => {
  const items = dropdown.selectAll<HTMLElement, AutocompleteOption>("div.f3-autocomplete-item").nodes() as HTMLElement[]
      const currentIndex = items.findIndex(item => d3.select(item).classed("f3-selected"))

      if (event.key === "ArrowDown") {
        event.preventDefault()
        const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0
        selectItem(items, nextIndex)
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1
        selectItem(items, prevIndex)
      } else if (event.key === "Enter" && currentIndex !== -1) {
        event.preventDefault()
        const option = d3.select(items[currentIndex]).datum() as AutocompleteOption | undefined
        if (option) this.onSelect(option.value)
      }
    }

    search_cont.on("focusout", () => {
      setTimeout(() => {
        const searchContNode = search_cont.node() as HTMLElement
        if (!searchContNode.contains(document.activeElement)) {
          closeDropdown()
        }
      }, 200)
    })

    search_input
      .on("focus", () => {
        updateOptions()
        activateDropdown()
      })
      .on("input", () => activateDropdown())
      .on("keydown", (event: KeyboardEvent) => handleArrowKeys(event))

    dropdown.on("wheel", (event: WheelEvent) => event.stopPropagation())

    search_cont.select(".f3-autocomplete-toggle")
      .on("click", (event: MouseEvent) => {
        event.stopPropagation()
        const isActive = search_cont.classed("active")
        search_cont.classed("active", !isActive)
        if (isActive) {
          closeDropdown()
        } else {
          const searchInputNode = search_input.node() as HTMLElement
          searchInputNode.focus()
          activateDropdown()
        }
      })
  }
  
  setOptionsGetter(getOptions: () => Autocomplete['options']) {
    this.getOptions = getOptions
    return this
  }
  
  setOptionsGetterPerson(getData: () => Datum[], getLabel: (d: Datum) => string) {
    this.getOptions = () => {
      const options: Autocomplete['options'] = []
      const data = getData()
      data.forEach(d => {
        if (d.to_add || d.unknown || d._new_rel_data) return
        if (options.find(d0 => d0.value === d.id)) return
        options.push({
          label: getLabel(d),
          value: d.id,
          optionHtml: optionHtml(d)
        })
      })
      return options
    }
    return this
  
    function optionHtml(d: Datum) {
      const link_off = !checkIfConnectedToFirstPerson(d, getData())
      return (option: AutocompleteOption) => (`
        <div>
          <span style="float: left; width: 10px; height: 10px; margin-right: 10px;" class="f3-${getPersonGender(d)}-color">${personSvgIcon()}</span>
          <span>${option.label_html || escapeHtml(option.label)}</span>
          ${link_off ? `<span style="float: right; width: 10px; height: 10px; margin-left: 5px;" title="Ce profil n'est pas relié au profil principal">${linkOffSvgIcon()}</span>` : ''}
        </div>
      `)
    }
  
    function getPersonGender(d: Datum) {
      if (d.data.gender === "M") return "male"
      else if (d.data.gender === "F") return "female"
      else return "genderless"
    }
  }
  
  destroy() {
    this.autocomplete_cont.remove()
  }

}

function buildHighlightedLabel(label: string, normalizedQuery: string): string {
  const safeLabel = escapeHtml(label)
  const trimmedQuery = normalizedQuery || ''
  if (!trimmedQuery) return safeLabel
  const lowerLabel = label.toLowerCase()
  const index = lowerLabel.indexOf(trimmedQuery)
  if (index === -1) return safeLabel
  const before = escapeHtml(label.slice(0, index))
  const match = escapeHtml(label.slice(index, index + trimmedQuery.length))
  const after = escapeHtml(label.slice(index + trimmedQuery.length))
  return `${before}<strong>${match}</strong>${after}`
}