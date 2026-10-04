import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { splitLayoutClassName } from "./layout-classes";

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
/** The native picker needs some valid value before the user has typed one (not a style color). */
const PICKER_FALLBACK = "#000000";

/** Expands 3-digit shorthand to 6 digits and lowercases; returns null when the value is not a hex color. */
export function normalizeHex(value: string): string | null {
  const v = value.trim();
  if (!HEX.test(v)) return null;
  if (v.length === 4) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  return v.toLowerCase();
}

type ColorInputProps = {
  /** Hex color (#rgb or #rrggbb). */
  value: string;
  /** Called with a valid hex string only (typed values are emitted once they are valid). */
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  /** Accessible name for the hex field when there is no <Label htmlFor>. */
  "aria-label"?: string;
  className?: string;
};

/**
 * Swatch (native color picker) + hex text field kept in sync. Invalid text is flagged
 * (aria-invalid + message) and not emitted; the swatch keeps the last valid color.
 */
export function ColorInput({ value, onChange, id, disabled, className, "aria-label": ariaLabel }: ColorInputProps) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-hex`;
  const errorId = `${inputId}-error`;
  const [text, setText] = useState(value);
  const { layout, control } = splitLayoutClassName(className);

  // Follow external changes (e.g. "reset to defaults").
  useEffect(() => {
    setText(value);
  }, [value]);

  const valid = normalizeHex(text) != null;
  const swatch = normalizeHex(text) ?? normalizeHex(value) ?? PICKER_FALLBACK;

  return (
    <div className={cn("w-full", layout)}>
      <div className={cn("flex items-center gap-2", control)}>
        <input
          type="color"
          value={swatch}
          disabled={disabled}
          aria-label={ariaLabel ? `${ariaLabel} picker` : "Color picker"}
          onChange={(e) => {
            setText(e.target.value);
            onChange(e.target.value);
          }}
          className={cn(
            "h-9 w-9 shrink-0 cursor-pointer rounded-md border border-input bg-surface p-1 shadow-xs",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-primary",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "[&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-none",
          )}
        />
        <Input
          id={inputId}
          value={text}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          aria-label={ariaLabel}
          aria-invalid={!valid || undefined}
          aria-describedby={!valid ? errorId : undefined}
          onChange={(e) => {
            const next = e.target.value;
            setText(next);
            if (normalizeHex(next)) onChange(next.trim());
          }}
          onBlur={() => {
            if (!normalizeHex(text)) return;
            setText(text.trim());
          }}
          className="w-28 font-mono uppercase"
        />
      </div>
      {!valid && (
        <p id={errorId} className="mt-1 text-xs font-medium text-danger">
          Enter a hex color like #006FBB.
        </p>
      )}
    </div>
  );
}
