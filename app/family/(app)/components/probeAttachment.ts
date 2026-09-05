/**
 * The DOM plumbing under a self-measuring surface, shared by the calendar's
 * `useGridGeometry` (002 T027) and the board's `useBoardGeometry` (003 T040).
 *
 * Both hooks decide a layout by MEASURING rather than by a breakpoint, and
 * both do it the same way: a hidden probe, sized purely by the tokens, is
 * appended inside the observed node so that measuring it IS resolving the
 * tokens (`calc(… * var(--fam-u))` never round-trips through `getComputedStyle`
 * as a number); a `ResizeObserver` watches the node and the probe's elements
 * — the probes resize on their own when `--fam-u` or the text-size rung
 * changes, which the node's border box need not — and a window `resize`
 * listener catches the rotations and toolbar collapses that flip an
 * orientation test without resizing the observed node at all.
 *
 * What the probe CONTAINS is each hook's own (an hour column, a gutter and a
 * title line against a task column), so the probe is built by the caller and
 * handed in with the list of its elements to watch.
 */

/** A probe: its hidden root and whatever token-sized elements it holds. */
export interface Probe {
  root: HTMLElement;
}

export interface ProbeAttachment<P extends Probe> {
  node: HTMLElement;
  probe: P;
  observer: ResizeObserver | null;
  onWindowResize: () => void;
}

/**
 * The hidden root every probe hangs off. `visibility: hidden` keeps layout
 * real; the negative offset cannot create scrollable overflow — which matters
 * inside a surface that is `overflow-x: hidden` and scrolls its own children.
 */
export function hiddenProbeRoot(doc: Document): HTMLElement {
  const root = doc.createElement("div");
  root.setAttribute("aria-hidden", "true");
  root.style.position = "absolute";
  root.style.left = "-9999px";
  root.style.top = "0";
  root.style.visibility = "hidden";
  root.style.pointerEvents = "none";
  return root;
}

/** Mounts the probe and starts watching; `onChange` fires on every resize. */
export function attachProbe<P extends Probe>(
  node: HTMLElement,
  probe: P,
  observed: readonly HTMLElement[],
  onChange: () => void,
): ProbeAttachment<P> {
  node.appendChild(probe.root);
  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(onChange);
    observer.observe(node);
    for (const element of observed) observer.observe(element);
  }
  window.addEventListener("resize", onChange);
  return { node, probe, observer, onWindowResize: onChange };
}

export function detachProbe(attachment: ProbeAttachment<Probe> | null): void {
  if (attachment === null) return;
  attachment.observer?.disconnect();
  window.removeEventListener("resize", attachment.onWindowResize);
  attachment.probe.root.remove();
}
