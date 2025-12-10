export * from './types/index'
export type { TreeDimensions } from './layout/calculate-tree'

export { default as createStore } from "./store/store"
export { default as view } from "./renderers/view"
export { default as createSvg } from "./renderers/svg"
export * as handlers from './handlers'
export * as elements from './elements'
export * as icons from './renderers/icons'
export { default as createChart } from './core/chart'
export { default as cardSvg } from './core/cards/card-svg'
export { default as cardHtml } from './core/cards/card-html'
export { default as createEditTree, EditTree } from "./core/edit"

export { formatData, formatDataForExport } from "./store/format-data"

export { CalculateTree } from "./layout/calculate-tree"

export { calculateTreeWithV1Data as calculateTree } from "./layout/calculate-tree"

export { Card } from './renderers/card-svg/card-svg'

import cardSvg from './core/cards/card-svg'
import cardHtml from './core/cards/card-html'
export const CardSvg = cardSvg
export const CardHtml = cardHtml
export { CardHtml as CardHtmlClass } from './core/cards/card-html'
export { CardSvg as CardSvgClass } from './core/cards/card-svg'

import * as htmlHandlers from './renderers/html'
import { setupHtmlSvg, setupReactiveTreeData, getUniqueId } from './features/card-component/handlers'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const htmlHandlersWithDeprecated = Object.assign({}, htmlHandlers, { setupHtmlSvg, setupReactiveTreeData, getUniqueId }) as any
export { htmlHandlersWithDeprecated as htmlHandlers }