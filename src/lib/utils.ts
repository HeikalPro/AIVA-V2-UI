import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge v2 (Tailwind v3 compatible) taught about this project's custom theme keys.
 * Without this, `text-ui` (custom font size) is classified as a text *color* and would be
 * dropped when combined with e.g. `text-muted-foreground`, and `shadow-focus` as a shadow color.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["ui"] }],
      shadow: [{ shadow: ["focus"] }],
    },
  },
});

/** Compose class names; later Tailwind classes win over conflicting earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
