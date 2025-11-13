import { TreeDatum } from "./treeData";
import { Link } from "../layout/create-links";
import { Selection, BaseType } from "d3";

export type CardHtmlSelection = Selection<HTMLDivElement, TreeDatum, BaseType, unknown>

export type LinkSelection = Selection<SVGPathElement, Link, BaseType, unknown>