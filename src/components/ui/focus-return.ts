/**
 * Focus return for overlays opened without a Radix <Trigger> (row click, a row's ⋮ menu, a
 * command-palette deep link). Radix restores focus to whatever was focused when the overlay
 * opened; when that element is gone (e.g. a menu item that unmounted), focus falls to <body>
 * and keyboard users lose their place.
 *
 * `withFocusReturn(handler)` wraps an `onCloseAutoFocus`: it lets the caller and Radix act first
 * and only steps in when focus actually ended up on <body>, moving it to the last element that was
 * focused outside any overlay (for a dropdown menu, the menu's trigger). Nested overlays keep
 * Radix's behaviour, because their restore target is still connected.
 */

const OVERLAY_SELECTOR =
  "[role=dialog], [role=alertdialog], [role=menu], [role=listbox], [data-radix-popper-content-wrapper]";

let lastOutside: HTMLElement | null = null;
let listening = false;

function onFocusIn(event: FocusEvent) {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target === document.body) return;
  const menu = target.closest("[role=menu]");
  if (menu) {
    // Radix labels a menu with its trigger; that trigger is the right place to come back to.
    const id = menu.getAttribute("aria-labelledby");
    const trigger = id ? document.getElementById(id) : null;
    if (trigger && !trigger.closest(OVERLAY_SELECTOR)) lastOutside = trigger;
    return;
  }
  if (target.closest(OVERLAY_SELECTOR)) return;
  lastOutside = target;
}

/** Starts tracking (idempotent). Called when an overlay renders, before it can open. */
export function trackFocusForReturn() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  document.addEventListener("focusin", onFocusIn, true);
}

export function withFocusReturn(handler?: (event: Event) => void) {
  return (event: Event) => {
    handler?.(event);
    if (event.defaultPrevented) return;
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body) return;
      if (lastOutside?.isConnected) lastOutside.focus();
    });
  };
}
