// Render SVG link paths with smooth transitions and sibling-aware staggering
import * as d3 from "d3";
import { createLinks } from "../layout/create-links";
import { calculateDelay } from "../handlers/general";
import { ViewProps } from "./view";
import { Tree } from "../layout/calculate-tree";
import { Link } from "../layout/create-links";

type AnimationMeta = {
  index: number
  count: number
}

type AnimatedLink = Link & {
  __animation?: AnimationMeta
}

export default function updateLinks(svg: SVGElement, tree: Tree, props: ViewProps = {}) {
  const links_data_dct = tree.data.reduce((acc: Record<string, Link>, d) => {
    createLinks(d, tree.is_horizontal).forEach((l) => (acc[l.id] = l));
    return acc;
  }, {});
  const links_data: Link[] = Object.values(links_data_dct);
  prepareAnimationMetadata(links_data, tree.is_horizontal)

  const baseDuration = Math.max(260, Math.round((props.transition_time ?? 200) * 1.25))
  const updateDuration = Math.max(220, Math.round(baseDuration * 0.85))
  const exitDuration = Math.max(200, Math.round(baseDuration * 0.7))
  const siblingDelayStep = Math.min(140, Math.round(baseDuration * 0.18))

  const link = d3
    .select(svg)
    .select(".links_view")
    .selectAll<SVGPathElement, Link>("path.link")
    .data(links_data, (d: Link) => d.id);

  if (props.transition_time === undefined)
    throw new Error("transition_time is undefined");

  const link_exit = link.exit();
  const link_enter = link.enter().append("path").attr("class", "link");
  const link_update = link_enter.merge(link);

  link_exit.each(linkExit);
  link_enter.each(linkEnter);
  link_update.each(linkUpdate);

  function linkEnter(this: SVGPathElement, d: Link) {
    const path = d3.select(this)
      .attr("fill", "none")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .style("opacity", 0)
      .attr("d", createPath(d, true, tree.is_horizontal));

    const meta = (d as AnimatedLink).__animation
    const extraDelay = meta ? meta.index * siblingDelayStep : 0
    const delay = (props.initial ? calculateDelay(tree, d, props.transition_time!) : 0) + extraDelay
    const offset = computeEntryOffset(meta, tree.is_horizontal)
    if (offset) {
      path.attr("transform", `translate(${formatNumber(offset[0])},${formatNumber(offset[1])})`)
    } else {
      path.attr("transform", "translate(0,0)")
    }

    // Animate to the final path and fade in in a single transition to avoid conflicts
    path.transition().duration(baseDuration).delay(delay).ease(d3.easeCubicInOut)
      .attr("d", createPath(d, false, tree.is_horizontal))
      .style("opacity", 1)
      .attr("transform", "translate(0,0)")
  }

  function linkUpdate(this: SVGPathElement, d: Link) {
    const path = d3.select(this);
    const meta = (d as AnimatedLink).__animation
    const extraDelay = meta ? meta.index * Math.max(40, Math.round(siblingDelayStep * 0.6)) : 0
    const delay = (props.initial ? calculateDelay(tree, d, props.transition_time!) : 0) + extraDelay

    // Ensure transform is reset before applying new animation
    path.interrupt().attr("transform", "translate(0,0)")

    // Use a single transition for both shape and opacity to keep animation smooth
    path.transition().duration(updateDuration).delay(delay).ease(d3.easeCubicInOut)
      .attr("d", createPath(d, false, tree.is_horizontal))
      .style("opacity", 1)
  }

  function linkExit(this: SVGPathElement, d: unknown | Link) {
    const path = d3.select(this);
    const meta = (d as AnimatedLink | undefined)?.__animation
    const extraDelay = meta ? (meta.count - meta.index - 1) * Math.max(30, Math.round(siblingDelayStep * 0.35)) : 0
    // Transition shape back to collapsed (_d) and fade out in one transition, then remove
    path.transition().duration(exitDuration).delay(extraDelay).ease(d3.easeSinInOut)
      .attr("d", createPath(d as Link, true, tree.is_horizontal))
      .style("opacity", 0)
      .attr("transform", "translate(0,0)")
      .on("end", () => path.remove());
  }
}

function prepareAnimationMetadata(links: Link[], isHorizontal: boolean): void {
  const groups = new Map<string, AnimatedLink[]>()

  links.forEach(link => {
    const animated = link as AnimatedLink
    animated.__animation = undefined
    if (link.spouse || link.is_ancestry === true) return
    if (!Array.isArray(link.source)) return

    const primaryParent = Array.isArray(link.source) ? (link.source[0] as unknown as Record<string, unknown>) : (link.source as unknown as Record<string, unknown>)
    const parentData = primaryParent?.data as Record<string, unknown> | undefined
    const parentId = parentData?.id ?? primaryParent?.id ?? primaryParent?.tid
    const groupKey = parentId ? `child:${String(parentId)}` : `child:${link.id}`

    if (!groups.has(groupKey)) groups.set(groupKey, [])
    groups.get(groupKey)!.push(animated)
  })

  groups.forEach(group => {
    const sorted = group.slice().sort((a, b) => {
      const sourceA = (Array.isArray(a.target) ? a.target[0] : a.target) as unknown as Record<string, number>
      const sourceB = (Array.isArray(b.target) ? b.target[0] : b.target) as unknown as Record<string, number>
      const posA = isHorizontal ? (sourceA?.y ?? 0) : (sourceA?.x ?? 0)
      const posB = isHorizontal ? (sourceB?.y ?? 0) : (sourceB?.x ?? 0)
      return posA - posB
    })

    sorted.forEach((link, index) => {
      link.__animation = { index, count: sorted.length }
    })
  })
}

function computeEntryOffset(meta: AnimationMeta | undefined, isHorizontal: boolean): [number, number] | null {
  if (!meta || meta.count <= 1) return null
  const center = (meta.count - 1) / 2
  const offsetIndex = meta.index - center
  const spreadStep = Math.min(14, 6 + meta.count)
  const displacement = offsetIndex * spreadStep
  return isHorizontal ? [0, displacement] : [displacement, 0]
}

function createPath(d: Link, is_: boolean = false, _is_horizontal: boolean = false) {
  const path_data: [number, number][] = is_ ? d._d() : d.d;

  if (!d.curve) return buildPolylinePath(path_data);
  return buildSmoothCurve(path_data, _is_horizontal);
}

function buildPolylinePath(points: [number, number][]): string {
  const deduped = dedupePoints(points);
  if (!deduped.length) return "";
  return deduped
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${formatNumber(x)},${formatNumber(y)}`)
    .join(" ");
}

function buildSmoothCurve(points: [number, number][], isHorizontal: boolean): string {
  const deduped = dedupePoints(points);
  if (deduped.length < 2) return buildPolylinePath(deduped);

  const pathParts: string[] = [];
  const start = deduped[0];
  pathParts.push(`M${formatNumber(start[0])},${formatNumber(start[1])}`);

  for (let i = 1; i < deduped.length; i++) {
    const current = deduped[i];
    const prev = deduped[i - 1];

    if (i === deduped.length - 1) {
      pathParts.push(`L${formatNumber(current[0])},${formatNumber(current[1])}`);
      continue;
    }

    const next = deduped[i + 1];
    const prevVec: [number, number] = [current[0] - prev[0], current[1] - prev[1]];
    const nextVec: [number, number] = [next[0] - current[0], next[1] - current[1]];
    const prevLength = Math.hypot(prevVec[0], prevVec[1]);
    const nextLength = Math.hypot(nextVec[0], nextVec[1]);

    if (prevLength === 0 || nextLength === 0) {
      pathParts.push(`L${formatNumber(current[0])},${formatNumber(current[1])}`);
      continue;
    }

    const cornerRadius = computeCornerRadius(prevLength, nextLength, isHorizontal);
    if (cornerRadius <= 0.5) {
      pathParts.push(`L${formatNumber(current[0])},${formatNumber(current[1])}`);
      continue;
    }

    const startCorner: [number, number] = [
      current[0] - (prevVec[0] / prevLength) * cornerRadius,
      current[1] - (prevVec[1] / prevLength) * cornerRadius
    ];

    const endCorner: [number, number] = [
      current[0] + (nextVec[0] / nextLength) * cornerRadius,
      current[1] + (nextVec[1] / nextLength) * cornerRadius
    ];

    pathParts.push(`L${formatNumber(startCorner[0])},${formatNumber(startCorner[1])}`);
    pathParts.push(`Q${formatNumber(current[0])},${formatNumber(current[1])} ${formatNumber(endCorner[0])},${formatNumber(endCorner[1])}`);
  }

  return pathParts.join(" ");
}

function computeCornerRadius(prevLength: number, nextLength: number, isHorizontal: boolean): number {
  const available = Math.min(prevLength, nextLength);
  if (available <= 0.001) return 0;

  const FIXED_RADIUS = isHorizontal ? 28 : 36;
  const maxByGeometry = Math.max(2, available / 2);

  return Math.min(FIXED_RADIUS, maxByGeometry);
}

function dedupePoints(points: [number, number][]): [number, number][] {
  if (points.length < 2) return points.slice();
  const deduped: [number, number][] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    const [prevX, prevY] = deduped[deduped.length - 1];
    if (x === prevX && y === prevY) continue;
    deduped.push([x, y]);
  }
  return deduped;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const fixed = Number(value.toFixed(3));
  return Number.isInteger(fixed) ? fixed.toString() : fixed.toString();
}