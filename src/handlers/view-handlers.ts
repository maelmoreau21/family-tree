import d3 from "../d3"
import type { ZoomBehavior, D3ZoomEvent } from 'd3-zoom'
import type { TreeDimensions } from "../layout/calculate-tree"
import { TreeDatum } from "../types/treeData"

interface ZoomEl extends HTMLElement {
  __zoomObj: ZoomBehavior<Element, unknown>
}

function positionTree({t, svg, transition_time=2000}: {t: {k: number, x: number, y: number}, svg: SVGElement, transition_time?: number}) {
  const el_listener = getZoomListener(svg)
  const zoomObj: ZoomBehavior<Element, unknown> = el_listener.__zoomObj

  const sel = d3.select(el_listener) as any
  const tr = sel.transition().duration(transition_time || 0).delay(transition_time ? 100 : 0)  // delay 100 because of weird error of undefined something in d3 zoom
  ;(tr as any).call((zoomObj as any).transform, d3.zoomIdentity.scale(t.k).translate(t.x, t.y))
}

type SvgDim = {width: number, height: number}
type TreeDim = TreeDimensions

interface TreeFitProps {
  svg: SVGElement
  svg_dim: SvgDim
  tree_dim: TreeDim
  transition_time?: number
}
export function treeFit({svg, svg_dim, tree_dim, transition_time}: TreeFitProps) {
  const t = calculateTreeFit(svg_dim, tree_dim);
  positionTree({t, svg, transition_time})
}

export function calculateTreeFit(svg_dim: SvgDim, tree_dim: TreeDim) {
  const width_scale = tree_dim.width > 0 ? svg_dim.width / tree_dim.width : Infinity
  const height_scale = tree_dim.height > 0 ? svg_dim.height / tree_dim.height : Infinity
  let k = Math.min(width_scale, height_scale, 1)
  if (!Number.isFinite(k) || k <= 0) k = 1

  const stabiliseRange = (min: number, max: number) => {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { min: 0, max: 0 }
    }
    if (min > max) {
      const mid = (min + max) / 2
      return { min: mid, max: mid }
    }
    return { min, max }
  }

  const withOverscroll = (desired: number, min: number, max: number, viewportSize: number) => {
    const overscroll = viewportSize * 0.25
    if (desired < min) {
      return Math.max(desired, min - overscroll)
    }
    if (desired > max) {
      return Math.min(desired, max + overscroll)
    }
    return desired
  }

  const txRange = stabiliseRange(-k * tree_dim.min_x, svg_dim.width - k * tree_dim.max_x)
  const desired_tx = svg_dim.width / 2 - k * tree_dim.center_x
  const tx = withOverscroll(desired_tx, txRange.min, txRange.max, svg_dim.width)

  const tyRange = stabiliseRange(-k * tree_dim.min_y, svg_dim.height - k * tree_dim.max_y)
  const desired_ty = svg_dim.height / 2 - k * tree_dim.center_y
  const ty = withOverscroll(desired_ty, tyRange.min, tyRange.max, svg_dim.height)

  const x = tx / k
  const y = ty / k

  return {k, x, y}
}


type CardToMiddleProps = {
  datum: TreeDatum
  svg: SVGElement
  svg_dim: SvgDim
  scale?: number
  transition_time?: number
}
export function cardToMiddle({datum, svg, svg_dim, scale, transition_time}: CardToMiddleProps) {
  const k = scale || 1, x = svg_dim.width/2-datum.x*k, y = svg_dim.height/2-datum.y,
    t = {k, x: x/k, y: y/k}
  positionTree({t, svg, transition_time})
}


type ManualZoomProps = {
  amount: number
  svg: SVGElement
  transition_time?: number
}
export function manualZoom({amount, svg, transition_time=500}: ManualZoomProps) {
  const el_listener = getZoomListener(svg)
  const zoomObj: ZoomBehavior<Element, unknown> = el_listener.__zoomObj
  if (!zoomObj) throw new Error('Zoom object not found')
  const sel = d3.select(el_listener) as any
  const tr = sel.transition().duration(transition_time || 0).delay(transition_time ? 100 : 0)  // delay 100 because of weird error of undefined something in d3 zoom
  ;(tr as any).call((zoomObj as any).scaleBy, amount)
}

export function getCurrentZoom(svg: SVGElement) {
  const el_listener = getZoomListener(svg)
  const currentTransform = d3.zoomTransform(el_listener)
  return currentTransform
}

export function zoomTo(svg: SVGElement, zoom_level: number) {
  const el_listener = getZoomListener(svg)
  const currentTransform = d3.zoomTransform(el_listener)
  manualZoom({amount: zoom_level / currentTransform.k, svg})
}

function getZoomListener(svg: SVGElement) {
  const el_listener = (svg as any).__zoomObj ? svg : (svg.parentNode as ZoomEl)
  if (!((el_listener as any).__zoomObj)) throw new Error('Zoom object not found')
  return el_listener as ZoomEl
}

export interface ZoomProps {
  onZoom?: (e: D3ZoomEvent<Element, unknown>) => void
  zoom_polite?: boolean
}


export function setupZoom(el: Element, props: ZoomProps = {}) {
  if ((el as any).__zoom) {
    // zoom already setup; silently return to avoid noisy logs in consumers
    return
  }
  const view = el.querySelector('.view')!
  const zoomBehavior: ZoomBehavior<Element, unknown> = (d3.zoom() as any).on("zoom", (props.onZoom || zoomed) as any)

  const sel = d3.select(el) as any
  sel.call(zoomBehavior)
  ;(el as any).__zoomObj = zoomBehavior

  if (props.zoom_polite) (zoomBehavior as any).filter(zoomFilter)

  function zoomed(e: D3ZoomEvent<Element, unknown>) {
    (d3.select(view) as any).attr("transform", (e as any).transform);
  }
  function zoomFilter(e: Event & { touches?: TouchList; ctrlKey?: boolean; type?: string }) {
    if (e.type === "wheel" && !e.ctrlKey) return false
    else if (e.touches && e.touches.length < 2) return false
    else return true
  }
}