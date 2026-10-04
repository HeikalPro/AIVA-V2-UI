import { useCallback, useEffect, useRef } from "react";

const OVERLAY_SELECTOR = "[role=dialog], [role=alertdialog], [role=menu], [role=listbox], [data-radix-popper-content-wrapper]";

/**
 * Focus return for dialogs/sheets opened without a Radix <Trigger> (row click, row ⋮ menu,
 * command-palette deep link). Radix only refocuses its own trigger, so focus would fall to <body>.
 * Tracks the last focused element outside overlays and puts focus back there on close.
 *
 *   const returnFocus = useReturnFocus();
 *   <DialogContent onCloseAutoFocus={returnFocus}>…
 */
export function useReturnFocus() {
  const lastRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function onFocusIn(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target === document.body) return;
      // Inside a dropdown menu (e.g. a row's ⋮ menu): remember the menu's trigger, which Radix
      // labels the menu with. Radix does not refocus it when the menu opens a dialog.
      const menu = target.closest("[role=menu]");
      if (menu) {
        const id = menu.getAttribute("aria-labelledby");
        const trigger = id ? document.getElementById(id) : null;
        if (trigger && !trigger.closest(OVERLAY_SELECTOR)) lastRef.current = trigger;
        return;
      }
      if (target.closest(OVERLAY_SELECTOR)) return;
      lastRef.current = target;
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  return useCallback((event: Event) => {
    const target = lastRef.current;
    if (target?.isConnected) {
      event.preventDefault();
      target.focus();
    }
  }, []);
}
