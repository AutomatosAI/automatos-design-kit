/**
 * PRD-261 B-02c: when a scripted answer arrives. Not an SDK name. Every answer of the fake chat and Deliverables
 * backends comes on the next timer tick (setTimeout 0), as a network answer comes after the render that asked:
 * a component renders between them, and a test on fake timers advances them.
 */
export function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}
