import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Placeholder block while data loads. Size it with height/width classes (h-4 w-32). Use instead of "Loading…" text. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("rounded-md bg-foreground/[0.07] motion-safe:animate-pulse", className)} {...props} />;
}

type SkeletonTextProps = {
  /** Number of lines (default 3). The last line is shorter. */
  lines?: number;
  className?: string;
  /** Line height class (default h-3.5). */
  lineClassName?: string;
};

/** A few lines of placeholder text. */
export function SkeletonText({ lines = 3, className, lineClassName }: SkeletonTextProps) {
  return (
    <div aria-hidden="true" className={cn("space-y-2", className)}>
      {Array.from({ length: Math.max(1, lines) }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full", lineClassName)}
        />
      ))}
    </div>
  );
}
