import { createContext, useContext, type ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";

/* =============================================================================================
 * Types
 * ============================================================================================= */

export type StatDelta = {
  /** Already formatted change, e.g. "+4.2%" or "-120ms". */
  value: ReactNode;
  direction: "up" | "down" | "flat";
  /**
   * Whether the change is good or bad (direction alone can't tell: latency going up is bad).
   * Default "neutral" (muted).
   */
  tone?: "positive" | "negative" | "neutral";
  /** Comparison text after the value, e.g. "vs previous 30 days". */
  label?: ReactNode;
};

export type StatEmphasis = "primary" | "secondary";

export type StatProps = {
  label: ReactNode;
  /** Pre-formatted value (formatNumber, formatPercent, formatMoney, formatDurationMs …). */
  value: ReactNode;
  /** Window / source under the value: "Last 30 days", "All time". */
  hint?: ReactNode;
  /** Alias of `hint`. */
  sublabel?: ReactNode;
  delta?: StatDelta;
  /** Small muted icon element, e.g. <Zap />. No coloured tiles. */
  icon?: ReactNode;
  /** primary = headline KPI (24px value), secondary = compact metric (18px). Default primary. */
  emphasis?: StatEmphasis;
  /** Skeleton value while loading. */
  loading?: boolean;
  /** Explains the metric (window, source, formula) in a tooltip on an ⓘ button. */
  info?: ReactNode;
  /** Accessible name of the ⓘ button (default "About <label>" when label is a string). */
  infoLabel?: string;
  className?: string;
};

type GroupVariant = "cards" | "strip";
const GroupContext = createContext<GroupVariant | null>(null);

/* =============================================================================================
 * Stat
 * ============================================================================================= */

const DELTA_TONE: Record<NonNullable<StatDelta["tone"]>, string> = {
  positive: "text-success",
  negative: "text-danger",
  neutral: "text-muted-foreground",
};

const DELTA_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight };

/**
 * A metric: label, value, optional hint/delta/info. Restrained: bordered surface (or a cell of a
 * `StatGroup variant="strip"`), small muted icon, no coloured tiles.
 */
export function Stat({
  label,
  value,
  hint,
  sublabel,
  delta,
  icon,
  emphasis = "primary",
  loading = false,
  info,
  infoLabel,
  className,
}: StatProps) {
  const groupVariant = useContext(GroupContext);
  const inStrip = groupVariant === "strip";
  const primary = emphasis === "primary";
  const note = hint ?? sublabel;
  const DeltaIcon = delta ? DELTA_ICON[delta.direction] : null;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col bg-card text-card-foreground",
        inStrip ? "border-b border-r border-border px-4 py-3" : "rounded-lg border border-border",
        !inStrip && (primary ? "px-5 py-4" : "px-4 py-3"),
        className,
      )}
    >
      <div className="flex min-h-5 items-center gap-1.5">
        <p className={cn("min-w-0 truncate font-medium text-muted-foreground", primary ? "text-ui" : "text-xs")}>{label}</p>
        {info != null && (
          <IconButton
            label={infoLabel ?? (typeof label === "string" ? `About ${label}` : "About this metric")}
            icon={Info}
            tooltip={info}
            size="sm"
            className="-my-1 h-5 w-5 shrink-0 text-subtle-foreground [&_svg]:h-3.5 [&_svg]:w-3.5"
          />
        )}
        {icon != null && (
          <span aria-hidden="true" className="ml-auto shrink-0 text-subtle-foreground [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
        )}
      </div>

      {loading ? (
        <div className={cn("flex items-center", primary ? "mt-1.5 h-8" : "mt-1 h-7")}>
          <Skeleton className={primary ? "h-6 w-28" : "h-5 w-20"} />
        </div>
      ) : (
        <div className={cn("flex min-w-0 flex-wrap items-baseline gap-x-2", primary ? "mt-1.5" : "mt-1")}>
          <p
            className={cn(
              "min-w-0 truncate font-semibold tabular-nums tracking-tight text-foreground",
              primary ? "text-2xl" : "text-lg leading-7",
            )}
          >
            {value}
          </p>
          {delta && DeltaIcon && (
            <p className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", DELTA_TONE[delta.tone ?? "neutral"])}>
              <DeltaIcon aria-hidden="true" className="h-3.5 w-3.5" />
              {delta.value}
              {delta.label && <span className="ml-1 font-normal text-muted-foreground">{delta.label}</span>}
            </p>
          )}
        </div>
      )}

      {note != null &&
        (loading ? (
          <div className={cn("flex h-4 items-center", primary ? "mt-1" : "mt-0.5")}>
            <Skeleton className="h-3 w-24" />
          </div>
        ) : (
          <p className={cn("truncate text-xs text-muted-foreground", primary ? "mt-1" : "mt-0.5")}>{note}</p>
        ))}
    </div>
  );
}

/* =============================================================================================
 * StatGroup
 * ============================================================================================= */

const COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  // 4-up only from xl: at lg the sidebar leaves ~180px per card, too narrow for label + info + icon.
  4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
};

export type StatGroupProps = {
  children: ReactNode;
  /** Columns at full width (responsive below). Default 4. */
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * cards (default) = separate bordered stats with gaps (headline KPIs).
   * strip = one bordered surface divided by hairlines (secondary metrics).
   */
  variant?: GroupVariant;
  /** Accessible name for the group (e.g. "Key metrics"). */
  "aria-label"?: string;
  className?: string;
};

/** Responsive grid of `Stat`s. */
export function StatGroup({ children, columns = 4, variant = "cards", "aria-label": ariaLabel, className }: StatGroupProps) {
  const grid = cn("grid", COLUMNS[columns] ?? COLUMNS[4]);
  return (
    <GroupContext.Provider value={variant}>
      {variant === "cards" ? (
        <div role="group" aria-label={ariaLabel} className={cn(grid, "gap-3", className)}>
          {children}
        </div>
      ) : (
        // Hairline dividers: every cell draws its right + bottom border; the outer edge ones are
        // clipped by the -1px margins, so wrapped/incomplete rows never show stray lines or gaps.
        <div role="group" aria-label={ariaLabel} className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
          <div className={cn(grid, "-mb-px -mr-px")}>{children}</div>
        </div>
      )}
    </GroupContext.Provider>
  );
}
