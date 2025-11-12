import type { BaseType, Selection } from "d3-selection"

type SanitisableElement = Element & { replaceChildren: (...nodes: Node[]) => void }

const UNSAFE_ELEMENT_NAMES = new Set(["SCRIPT", "OBJECT", "EMBED", "APPLET"])
const URL_ATTRIBUTES = new Set(["href", "src", "xlink:href", "action", "formaction"])

function isEnvironmentDomCapable(): boolean {
  return typeof document !== "undefined" && typeof document.createElement === "function"
}

function isSafeUrl(value: string, attrName: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  const lower = trimmed.toLowerCase()
  if (lower.startsWith("javascript:")) return false
  if (lower.startsWith("data:")) {
    return attrName === "src" || attrName === "xlink:href"
  }
  if (/^[a-z][a-z0-9+.+-]*:/.test(trimmed)) {
    return lower.startsWith("http:") || lower.startsWith("https:") || lower.startsWith("mailto:") || lower.startsWith("tel:")
  }
  return true
}

function sanitiseNode(node: Node): void {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element
    const tagName = element.tagName.toUpperCase()
    if (UNSAFE_ELEMENT_NAMES.has(tagName)) {
      element.remove()
      return
    }
    Array.from(element.attributes).forEach(attr => {
      const name = attr.name
      const normalized = name.toLowerCase()
      const value = attr.value
      if (normalized.startsWith("on")) {
        element.removeAttribute(name)
        return
      }
      if (normalized === "style") {
        const lowerValue = value.toLowerCase()
        if (lowerValue.includes("expression(") || lowerValue.includes("javascript:")) {
          element.removeAttribute(name)
          return
        }
      }
      if (URL_ATTRIBUTES.has(normalized)) {
        if (!isSafeUrl(value, normalized)) {
          element.removeAttribute(name)
        }
      }
    })
  }

  let child = node.firstChild
  while (child) {
    const next = child.nextSibling
    sanitiseNode(child)
    child = next
  }
}

function createHtmlFragment(html: string): DocumentFragment {
  const template = document.createElement("template")
  template.innerHTML = html
  sanitiseNode(template.content)
  return template.content
}

function applySanitisedHtml(target: SanitisableElement, html: string, context?: string): void {
  if (!isEnvironmentDomCapable()) {
    target.innerHTML = html
    return
  }
  const fragment = target instanceof SVGElement
    ? createSvgFragment(html)
    : createHtmlFragment(html)
  const nodes = Array.from(fragment.childNodes)
  target.replaceChildren(...nodes)
  if (nodes.length === 0 && html && context && typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(`Safe HTML sanitisation removed all content for ${context}. Input may contain unsupported markup.`)
  }
}

function createSvgFragment(html: string): DocumentFragment {
  if (typeof DOMParser === "undefined") {
    return createHtmlFragment(html)
  }
  const parser = new DOMParser()
  const wrapped = `<svg xmlns="http://www.w3.org/2000/svg">${html}</svg>`
  const doc = parser.parseFromString(wrapped, "image/svg+xml")
  const fragment = document.createDocumentFragment()
  const svgRoot = doc.documentElement
  Array.from(svgRoot.childNodes).forEach(child => {
    const imported = document.importNode(child, true)
    fragment.appendChild(imported)
  })
  sanitiseNode(fragment)
  return fragment
}

export function setElementHtml(target: Element | null, html: string, context?: string): void {
  if (!target) return
  applySanitisedHtml(target as SanitisableElement, html, context)
}

export function clearElement(target: Element | null): void {
  if (!target) return
  if (!isEnvironmentDomCapable()) {
    target.innerHTML = ""
    return
  }
  target.replaceChildren()
}

export function updateSelectionHtml<T extends BaseType, D>(selection: Selection<T, D, any, any>, html: string, context?: string): void {
  if (!selection) return
  selection.each(function updateSafeHtml() {
    applySanitisedHtml(this as SanitisableElement, html, context)
  })
}
