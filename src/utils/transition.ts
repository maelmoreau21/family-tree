import * as d3 from "d3";

export const DEFAULT_TRANSITION_TIME = 2000;
export const DEFAULT_EASING = d3.easeCubicInOut;

export interface TransitionConfig {
  duration: number;
  ease: (t: number) => number;
  delay?: number;
}

export function getTransitionConfig(
  transition_time: number = DEFAULT_TRANSITION_TIME,
  delay: number = 0
): TransitionConfig {
  return {
    duration: transition_time,
    ease: DEFAULT_EASING,
    delay: delay,
  };
}

export function applyTransition<GElement extends d3.BaseType, Datum, PElement extends d3.BaseType, PDatum>(
  selection: d3.Selection<GElement, Datum, PElement, PDatum>,
  config: TransitionConfig
): d3.Transition<GElement, Datum, PElement, PDatum> {
  return selection
    .transition()
    .duration(config.duration)
    .delay(config.delay || 0)
    .ease(config.ease);
}
