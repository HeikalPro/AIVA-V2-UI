import { useState } from "react";
import { cn } from "@/lib/utils";

/** "Ahmed Hassan" → "AH", "rana@x.com" → "R", "محمد عبد الله" → "م". */
export function initials(name: string | null | undefined): string {
  const clean = (name ?? "").split("@")[0].trim();
  if (!clean) return "?";
  // Arabic letters join, so a two-letter "initial" reads as a fragment of a word; use one letter.
  if (/[؀-ۿ]/.test(clean)) return clean.charAt(0);
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 1);
  return letters.toUpperCase();
}

const SIZE = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
} as const;

type AvatarProps = {
  /** Person or account name; used for initials and alt text. */
  name?: string | null;
  src?: string | null;
  size?: keyof typeof SIZE;
  className?: string;
  /** Native hover title; defaults to `name`. Pass `false` when a Tooltip or visible label already names it. */
  title?: string | false;
};

/** Circular avatar: image when available, otherwise initials on the primary tint. */
export function Avatar({ name, src, size = "md", className, title }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-primary-muted font-semibold text-primary-muted-foreground",
        SIZE[size],
        className,
      )}
      title={title === false ? undefined : (title ?? name ?? undefined)}
    >
      {showImage ? (
        <img src={src!} alt={name ?? ""} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden={name ? true : undefined}>{initials(name)}</span>
      )}
      {!showImage && name && <span className="sr-only">{name}</span>}
    </span>
  );
}
