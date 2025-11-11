import * as d3 from "../d3"
import {createLinks} from "../layout/create-links"
import {calculateDelay} from "../handlers/general"
import { ViewProps } from "./view"
import { Tree } from "../layout/calculate-tree"
import { Link } from "../layout/create-links"
import { LinkSelection } from "../types/view"

export default function updateLinks(svg: SVGElement, tree: Tree, props: ViewProps = {}) {
  const links_data_dct = tree.data.reduce((acc: Record<string, Link>, d) => {
    createLinks(d, tree.is_horizontal).forEach(l => acc[l.id] = l)
    return acc
  }, {})
  const links_data: Link[] = Object.values(links_data_dct)
  const link: LinkSelection = d3
    .select(svg)
    .select(".links_view")
    .selectAll<SVGPathElement, Link>("path.link")
    .data(links_data, d => d.id)

  if (props.transition_time === undefined) throw new Error('transition_time is undefined')
  const link_exit = link.exit();
  const link_enter = link.enter().append("path").attr("class", "link");
  const link_update = link_enter.merge(link);

  link_exit.each(linkExit)
  link_enter.each(linkEnter)
  link_update.each(linkUpdate)

  function linkEnter(this: SVGPathElement, d: Link) {
    d3.select(this).attr("fill", "none").attr("stroke", "#fff").attr("stroke-width", 1).style("opacity", 0)
      .attr("d", createPath(d, true, tree.is_horizontal))
  }

  function linkUpdate(this: SVGPathElement, d: Link) {
    const path = d3.select(this);
    const delay = props.initial ? calculateDelay(tree, d, props.transition_time!) : 0
    path.transition('path').duration(props.transition_time!).delay(delay).attr("d", createPath(d, false, tree.is_horizontal)).style("opacity", 1)
  }

  function linkExit(this: SVGPathElement, d: unknown | Link) {
    const path = d3.select(this);
    path.transition('op').duration(800).style("opacity", 0)
    path.transition('path').duration(props.transition_time!).attr("d", createPath(d as Link, true, tree.is_horizontal))
      .on("end", () => path.remove())
  }

}

function createPath(d: Link, is_: boolean = false, _is_horizontal: boolean = false) {
  const path_data: [number, number][] = is_ ? d._d() : d.d

  if (!d.curve) return buildPolylinePath(path_data)
  return buildSmoothCurve(path_data, _is_horizontal)
}

function buildPolylinePath(points: [number, number][]): string {
  const deduped = dedupePoints(points)
  if (!deduped.length) return ""
  return deduped
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${formatNumber(x)},${formatNumber(y)}`)
    .join(" ")
}

function buildSmoothCurve(points: [number, number][], isHorizontal: boolean): string {
  const deduped = dedupePoints(points)
  if (deduped.length < 2) return buildPolylinePath(deduped)

  const start = deduped[0]
  const end = deduped[deduped.length - 1]
  const deltaPrimary = isHorizontal ? end[0] - start[0] : end[1] - start[1]
  if (deltaPrimary === 0) return buildPolylinePath(deduped)

  const mid = deduped[Math.floor(deduped.length / 2)] ?? [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]
  const maxOffset = Math.max(10, Math.abs(deltaPrimary) * 0.5)
  const desiredOffset = Math.abs(deltaPrimary) * 0.45
  const minOffset = Math.min(40, maxOffset)
  const offset = clamp(desiredOffset, minOffset, maxOffset)
  const sign = deltaPrimary > 0 ? 1 : -1

  let control1: [number, number]
  let control2: [number, number]

  if (isHorizontal) {
    const midY = mid[1]
    control1 = [start[0] + sign * offset, start[1] + (midY - start[1]) * 0.35]
    control2 = [end[0] - sign * offset, end[1] + (midY - end[1]) * 0.35]
  } else {
    const midX = mid[0]
    control1 = [start[0] + (midX - start[0]) * 0.35, start[1] + sign * offset]
    control2 = [end[0] + (midX - end[0]) * 0.35, end[1] - sign * offset]
  }

  return `M${formatNumber(start[0])},${formatNumber(start[1])} C${formatNumber(control1[0])},${formatNumber(control1[1])} ${formatNumber(control2[0])},${formatNumber(control2[1])} ${formatNumber(end[0])},${formatNumber(end[1])}`
}

function dedupePoints(points: [number, number][]): [number, number][] {
  if (points.length < 2) return points.slice()
  const deduped: [number, number][] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i]
    const [prevX, prevY] = deduped[deduped.length - 1]
    if (x === prevX && y === prevY) continue
    deduped.push([x, y])
  }
  return deduped
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) return max
  return Math.min(Math.max(value, min), max)
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0"
  const fixed = Number(value.toFixed(3))
  return Number.isInteger(fixed) ? fixed.toString() : fixed.toString()
}