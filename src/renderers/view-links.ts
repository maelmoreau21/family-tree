// Fixed typing issues for D3 selection and data binding
import * as d3 from "../d3";
import { createLinks } from "../layout/create-links";
import { calculateDelay } from "../handlers/general";
import { ViewProps } from "./view";
import { Tree } from "../layout/calculate-tree";
import { Link } from "../layout/create-links";

export default function updateLinks(svg: SVGElement, tree: Tree, props: ViewProps = {}) {
  const links_data_dct = tree.data.reduce((acc: Record<string, Link>, d) => {
    createLinks(d, tree.is_horizontal).forEach((l) => (acc[l.id] = l));
    return acc;
  }, {});
  const links_data: Link[] = Object.values(links_data_dct);

    const link: any = d3
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
    d3.select(this)
      .attr("fill", "none")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .style("opacity", 0)
      .attr("d", createPath(d, true, tree.is_horizontal));
  }

  function linkUpdate(this: SVGPathElement, d: Link) {
    const path = d3.select(this);
    const delay = props.initial
      ? calculateDelay(tree, d, props.transition_time!)
      : 0;
    path
      .transition("path")
      .duration(props.transition_time!)
      .delay(delay)
      .attr("d", createPath(d, false, tree.is_horizontal))
      .style("opacity", 1);
  }

  function linkExit(this: SVGPathElement, d: unknown | Link) {
    const path = d3.select(this);
    path.transition("op").duration(800).style("opacity", 0);
    path
      .transition("path")
      .duration(props.transition_time!)
      .attr("d", createPath(d as Link, true, tree.is_horizontal))
      .on("end", () => path.remove());
  }
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

  const DEFAULT_CORNER_RADIUS = isHorizontal ? 28 : 36;

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

    const cornerRadius = Math.min(DEFAULT_CORNER_RADIUS, prevLength / 2, nextLength / 2);
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