/** Keyboard helpers shared by the shell's global shortcuts. */

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? nav.platform ?? nav.userAgent;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** "⌘" on Apple platforms, "Ctrl" elsewhere. */
export function modKeyLabel(): string {
  return isMacPlatform() ? "⌘" : "Ctrl";
}

/** The command-palette chord as shown to the user: "⌘K" / "Ctrl K". */
export function commandMenuShortcutLabel(): string {
  return isMacPlatform() ? "⌘K" : "Ctrl K";
}

/** True when the event target is a place where typing text is expected. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(type);
  }
  return target.getAttribute("role") === "textbox";
}

/** Ctrl+K / ⌘K (any focus; the modifier makes it safe inside text fields). */
export function isCommandMenuChord(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k";
}
