import * as d3 from "d3"
import type { Selection } from "d3-selection"
import {calculateEnterAndExitPositions} from "../../layout/handlers"
import {calculateDelay} from "../../handlers/general"
import {getCardsViewFake} from "./handlers"
import { Tree } from "../../layout/calculate-tree"
import { ViewProps } from "../../renderers/view"
import { TreeDatum } from "../../types/treeData"
import { getTransitionConfig, applyTransition } from "../../utils/transition"

type CardComponentRenderer = (datum: TreeDatum) => HTMLElement

export default function updateCardsComponent(svg: SVGElement, tree: Tree, Card: CardComponentRenderer, props: ViewProps = {}) {
  const div = props.cardHtmlDiv ? props.cardHtmlDiv : svg.closest('#f3Canvas')!.querySelector('#htmlSvg') as HTMLElement
  const container = d3.select<HTMLElement, undefined>(getCardsViewFake(() => div))
  const card: Selection<HTMLDivElement, TreeDatum, HTMLElement, undefined> = container
    .selectAll<HTMLDivElement, TreeDatum>("div.card_cont_fake")
    .data(tree.data, d => d.data.id)
  const card_exit = card.exit() as Selection<HTMLDivElement, TreeDatum, HTMLElement, undefined>
  const card_enter = card
    .enter()
    .append("div")
    .attr("class", "card_cont_fake")
    .style('display', 'none') as Selection<HTMLDivElement, TreeDatum, HTMLElement, undefined>
  const card_update = card_enter.merge(card) as Selection<HTMLDivElement, TreeDatum, HTMLElement, undefined>

  card_exit.each(d => calculateEnterAndExitPositions(d, false, true))
  card_enter.each(d => calculateEnterAndExitPositions(d, true, false))

  card_exit.each(cardExit)
  card_enter.each(cardEnter)
  card_update.each(cardUpdate)

  function cardEnter(this: HTMLDivElement, d: TreeDatum) {
    const card_element = d3.select(Card(d))

    card_element
      .style('position', 'absolute')
      .style('top', '0').style('left', '0').style("opacity", 0)
      .style("transform", `translate(${d._x}px, ${d._y}px)`)
  }

 

  function cardUpdate(this: HTMLDivElement, d: TreeDatum) {
    const card_element = d3.select(Card(d))
    const baseDelay = props.transition_time ? 100 : 0;
    const delay = (props.initial ? calculateDelay(tree, d, props.transition_time!) : 0) + baseDelay;
    const config = getTransitionConfig(props.transition_time!, delay)
    applyTransition(card_element, config)
      .style("transform", `translate(${d.x}px, ${d.y}px)`)
      .style("opacity", 1)
  }

  function cardExit(this: HTMLDivElement, d: TreeDatum) {
    const pos = [d._x, d._y]
    const card_element = d3.select(Card(d))
    const g = d3.select(this)
    card_element.transition().duration(props.transition_time!).style("opacity", 0).style("transform", `translate(${pos[0]}px, ${pos[1]}px)`)
      .on("end", () => g.remove()) // remove the card_cont_fake
  }
}