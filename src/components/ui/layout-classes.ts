/**
 * Splits a className into "layout" classes (outer box: margin, width, flex/grid placement,
 * display) and the rest. Used by primitives that wrap a native control in an extra element
 * (Select, SearchInput, ColorInput) so `className="mt-1 w-40"` positions/sizes the whole control
 * while visual classes such as `h-8` or `text-xs` still reach the control itself.
 */
const LAYOUT_CLASS =
  /^(-?m[trblxyse]?-|w-|min-w-|max-w-|basis-|flex-(1|auto|initial|none)$|grow|shrink|self-|justify-self-|place-self-|order-|col-(span|start|end)-|row-(span|start|end)-|(hidden|block|inline-block|inline-flex|contents)$)/;

export function splitLayoutClassName(className?: string): { layout: string; control: string } {
  if (!className) return { layout: "", control: "" };
  const layout: string[] = [];
  const control: string[] = [];
  for (const token of className.split(/\s+/)) {
    if (!token) continue;
    // Strip variant prefixes (sm:, hover:, group-hover: …) and the important flag before testing.
    const base = token.slice(token.lastIndexOf(":") + 1).replace(/^!/, "");
    (LAYOUT_CLASS.test(base) ? layout : control).push(token);
  }
  return { layout: layout.join(" "), control: control.join(" ") };
}
