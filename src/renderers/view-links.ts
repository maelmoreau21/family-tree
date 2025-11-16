// Render SVG link paths with smooth transitions and sibling-aware staggering
import * as d3 from "d3";
import { createLinks } from "../layout/create-links";
import { calculateDelay } from "../handlers/general";
import { ViewProps } from "./view";
import { Tree } from "../layout/calculate-tree";
import { Link } from "../layout/create-links";
import { LinkStyle } from "../types/store";

type AnimationMeta = {
  index: number
  count: number
  offset?: { dx: number; dy: number }
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
  const linkStyle: LinkStyle = props.link_style ?? 'smooth'

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
      .attr("d", createPath(d, true, linkStyle, tree.is_horizontal));

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
      .attr("d", createPath(d, false, linkStyle, tree.is_horizontal))
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
      .attr("d", createPath(d, false, linkStyle, tree.is_horizontal))
      .style("opacity", 1)
  }

  function linkExit(this: SVGPathElement, d: unknown | Link) {
    const path = d3.select(this);
    const meta = (d as AnimatedLink | undefined)?.__animation
    const extraDelay = meta ? (meta.count - meta.index - 1) * Math.max(30, Math.round(siblingDelayStep * 0.35)) : 0
    // Transition shape back to collapsed (_d) and fade out in one transition, then remove
    path.transition().duration(exitDuration).delay(extraDelay).ease(d3.easeSinInOut)
      .attr("d", createPath(d as Link, true, linkStyle, tree.is_horizontal))
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
      const offset = computeSiblingOffsetVector(index, sorted.length, isHorizontal)
      link.__animation = { index, count: sorted.length, offset }
    })
  })
}

function computeEntryOffset(meta: AnimationMeta | undefined, isHorizontal: boolean): [number, number] | null {
  if (!meta?.offset) return null
  const easeFactor = isHorizontal ? 0.3 : 0.35
  const dx = meta.offset.dx * easeFactor
  const dy = meta.offset.dy * easeFactor
  if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) return null
  return [dx, dy]
}

function createPath(
  link: Link,
  collapsed: boolean = false,
  style: LinkStyle = "smooth",
  isHorizontal: boolean = false
) {
  const animated = link as AnimatedLink;
  const sourcePoints = (collapsed ? link._d() : link.d).map(([x, y]) => [x, y] as [number, number]);
  const isDescendantLink = link.is_ancestry === false && !link.spouse && Array.isArray(link.source)
  const deduped = dedupePoints(sourcePoints);
  const pointsWithOffset = applySiblingOffset(deduped, animated.__animation)
  const points = pointsWithOffset
  const fallbackPoints = pointsWithOffset

  if (points.length < 2) {
    return buildPolylinePath(fallbackPoints)
  }

  if (!link.curve) {
    return buildPolylinePath(fallbackPoints)
  }

  if (style === "legacy") {
    return buildLegacyCurve(fallbackPoints, isHorizontal)
  }

  if (style === "smooth") {
    const isAncestorLink = link.is_ancestry === true

    const smoothCurve = (isAncestorLink || isDescendantLink)
      ? (isHorizontal ? d3.curveMonotoneX : d3.curveMonotoneY)
      : d3.curveBasis

    const smoothLine = d3
      .line<[number, number]>()
      .x((d) => d[0])
      .y((d) => d[1])
      .curve(smoothCurve)
    // If the points only contain a start and end (or simple mid points),
    // prefer an explicit cubic bezier based on the vector between the end points
    // to ensure consistent perpendicular offsets and avoid inversion issues.
    if (points && points.length >= 2) {
      const p0 = { x: points[0][0], y: points[0][1] }
      const p3 = { x: points[points.length - 1][0], y: points[points.length - 1][1] }
      // prefer using explicit cubic bezier for ancestry/descendant links to control offsets
      if ((isAncestorLink || isDescendantLink) && !link.spouse) {
        const linkDirection: CubicDirection = isAncestorLink
          ? 'ancestor'
          : isDescendantLink
            ? 'descendant'
            : 'other'
        const { d: pathStr } = cubicBezierPath(p0, p3, {
          isHorizontal,
          linkDirection
        })
        return pathStr
      }
    }

    return smoothLine(points) ?? buildPolylinePath(fallbackPoints)
  }

  const monotoneLine = d3
    .line<[number, number]>()
    .x((d) => d[0])
    .y((d) => d[1])
    .curve(isHorizontal ? d3.curveMonotoneX : d3.curveMonotoneY)

  return monotoneLine(points) ?? buildPolylinePath(fallbackPoints)
}

type CubicDirection = 'ancestor' | 'descendant' | 'other'

type CubicOptions = {
  isHorizontal?: boolean
  linkDirection?: CubicDirection
}

function cubicBezierPath(
  p0: { x: number; y: number },
  p3: { x: number; y: number },
  options: CubicOptions = {}
) {
  const { isHorizontal = false, linkDirection = 'other' } = options
  const dx = p3.x - p0.x
  const dy = p3.y - p0.y

  if (linkDirection === 'ancestor' || linkDirection === 'descendant') {
    if (isHorizontal) {
      const axisSign = dx === 0 ? 1 : Math.sign(dx)
      const flow = clamp(Math.abs(dx) * 0.4, 18, 130)
      const c1 = { x: p0.x + flow * axisSign, y: p0.y }
      const c2 = { x: p3.x - flow * axisSign, y: p3.y }
      return {
        d: `M ${formatNumber(p0.x)},${formatNumber(p0.y)} C ${formatNumber(c1.x)},${formatNumber(c1.y)} ${formatNumber(c2.x)},${formatNumber(c2.y)} ${formatNumber(p3.x)},${formatNumber(p3.y)}`,
        controls: { c1, c2 }
      }
    }

    const axisSign = dy === 0 ? 1 : Math.sign(dy)
    const flow = clamp(Math.abs(dy) * 0.4, 20, 120)
    const c1 = { x: p0.x, y: p0.y + flow * axisSign }
    const c2 = { x: p3.x, y: p3.y - flow * axisSign }
    return {
      d: `M ${formatNumber(p0.x)},${formatNumber(p0.y)} C ${formatNumber(c1.x)},${formatNumber(c1.y)} ${formatNumber(c2.x)},${formatNumber(c2.y)} ${formatNumber(p3.x)},${formatNumber(p3.y)}`,
      controls: { c1, c2 }
    }
  }

  // Descendant links now reuse the same perpendicular-vector logic as other links
  // to ensure they mirror the ascendant visual style.

  const span = Math.hypot(dx, dy) || 1
  const base = Math.min(140, Math.max(24, span * 0.18))
  const c1 = { x: p0.x + dx * 0.35, y: p0.y + dy * 0.35 }
  const c2 = { x: p3.x - dx * 0.35, y: p3.y - dy * 0.35 }
  const adjustX = (-dy / span) * base * 0.25
  const adjustY = (dx / span) * base * 0.25
  const finalC1 = { x: c1.x + adjustX, y: c1.y + adjustY }
  const finalC2 = { x: c2.x + adjustX, y: c2.y + adjustY }

  return {
    d: `M ${formatNumber(p0.x)},${formatNumber(p0.y)} C ${formatNumber(finalC1.x)},${formatNumber(finalC1.y)} ${formatNumber(finalC2.x)},${formatNumber(finalC2.y)} ${formatNumber(p3.x)},${formatNumber(p3.y)}`,
    controls: { c1: finalC1, c2: finalC2 }
  }
}

function applySiblingOffset(points: [number, number][], meta: AnimationMeta | undefined): [number, number][] {
  if (!meta?.offset) return points
  const dx = clamp(meta.offset.dx, -18, 18)
  const dy = clamp(meta.offset.dy, -18, 18)
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return points

  const totalSegments = points.length - 1
  if (totalSegments <= 1) return points

  const adjusted = points.map(([x, y]) => [x, y] as [number, number])
  for (let i = 1; i < totalSegments; i++) {
    const t = i / totalSegments
    const weight = Math.sin(Math.PI * t) * 0.6
    if (!Number.isFinite(weight)) continue
    // Detect direction of incoming and outgoing segments to avoid moving
    // the coordinate that must stay aligned for a clean right-angle elbow.
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]
    const prevVec: [number, number] = [curr[0] - prev[0], curr[1] - prev[1]]
    const nextVec: [number, number] = [next[0] - curr[0], next[1] - curr[1]]

    const prevVertical = Math.abs(prevVec[0]) < 0.001
    const prevHorizontal = Math.abs(prevVec[1]) < 0.001
    const nextVertical = Math.abs(nextVec[0]) < 0.001
    const nextHorizontal = Math.abs(nextVec[1]) < 0.001

    // If both prev and next are vertical, avoid modifying the X coordinate
    if (Math.abs(dx) > 0.01 && !(prevVertical && nextVertical)) {
      adjusted[i][0] += dx * weight
    }
    // If both prev and next are horizontal, avoid modifying the Y coordinate
    if (Math.abs(dy) > 0.01 && !(prevHorizontal && nextHorizontal)) {
      adjusted[i][1] += dy * weight
    }
  }
  return adjusted
}

function computeSiblingOffsetVector(index: number, count: number, isHorizontal: boolean): { dx: number; dy: number } | undefined {
  if (count <= 1) return undefined
  const center = (count - 1) / 2
  const offsetIndex = index - center
  if (Math.abs(offsetIndex) < 0.05) return undefined

  const baseSpread = isHorizontal ? 10 : 12
  const scale = Math.min(20, baseSpread + count)
  const displacement = clamp(offsetIndex * scale, -24, 24)

  return isHorizontal ? { dx: 0, dy: displacement } : { dx: displacement, dy: 0 }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}


function buildPolylinePath(points: [number, number][]): string {
  const deduped = dedupePoints(points);
  if (!deduped.length) return "";
  return deduped
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${formatNumber(x)},${formatNumber(y)}`)
    .join(" ");
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

function buildLegacyCurve(points: [number, number][], isHorizontal: boolean): string {
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
  const minAvailable = Math.min(prevLength, nextLength);
  if (minAvailable <= 0.001) return 0;

  const minRadius = isHorizontal ? 16 : 20;
  const idealRadius = isHorizontal ? 32 : 40;
  const growthScale = isHorizontal ? 48 : 64;

  const maxGeometricRadius = Math.max(2, minAvailable / 2);
  const easedTarget = idealRadius * (1 - Math.exp(-minAvailable / growthScale));
  const clampedTarget = Math.max(minRadius, Math.min(easedTarget, idealRadius));

  return Math.min(clampedTarget, maxGeometricRadius);
}

 