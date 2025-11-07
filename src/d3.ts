import {
  select,
  selectAll,
  create
} from 'd3-selection'
import type { Selection, BaseType } from 'd3-selection'
import { line, curveMonotoneY, curveBasis } from 'd3-shape'
import { hierarchy, tree } from 'd3-hierarchy'
import type { HierarchyNode } from 'd3-hierarchy'
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom'
import type { ZoomBehavior } from 'd3-zoom'
import { extent } from 'd3-array'
import 'd3-transition'

const d3 = {
  select,
  selectAll,
  create,
  line,
  curveMonotoneY,
  curveBasis,
  hierarchy,
  tree,
  zoom,
  zoomIdentity,
  zoomTransform,
  extent
}

export default d3

export {
  select,
  selectAll,
  create,
  line,
  curveMonotoneY,
  curveBasis,
  hierarchy,
  tree,
  zoom,
  zoomIdentity,
  zoomTransform,
  extent
}

export type { Selection, BaseType } from 'd3-selection'
export type { HierarchyNode } from 'd3-hierarchy'
export type { ZoomBehavior } from 'd3-zoom'
