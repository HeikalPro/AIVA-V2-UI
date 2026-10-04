import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./empty-state";

/*
 * Chart system for Recharts. Recharts needs real colour strings in SVG attributes, so the design
 * tokens (CSS variables holding HSL channels) are resolved here and recomputed when the theme
 * changes. Never hard-code colours in a chart: take them from useChartTheme().
 *
 *   const theme = useChartTheme();
 *   <ChartCard title="AI activity" height={240} loading={isLoading} isEmpty={!data.length}>
 *     <ResponsiveContainer width="100%" height="100%">
 *       <AreaChart data={data} margin={CHART_MARGIN}>
 *         <CartesianGrid {...chartGridProps(theme)} />
 *         <XAxis dataKey="day" {...chartAxisProps(theme)} />
 *         <YAxis {...chartAxisProps(theme)} width={40} />
 *         <Tooltip cursor={chartCursor(theme)} content={<ChartTooltip valueFormatter={(v) => formatNumber(Number(v))} />} />
 *         <Area dataKey="calls" stroke={theme.series[0]} fill={alpha(theme.series[0], 0.12)} />
 *       </AreaChart>
 *     </ResponsiveContainer>
 *   </ChartCard>
 */

/* =============================================================================================
 * Theme
 * ============================================================================================= */

export type ChartTheme = {
  /** chart-1 … chart-5. series[0] (company blue) is the primary series. */
  series: [string, string, string, string, string];
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipFg: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  surface: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  neutral: string;
};

const TOKEN: Record<Exclude<keyof ChartTheme, "series">, string> = {
  grid: "--chart-grid",
  axis: "--chart-axis",
  tooltipBg: "--chart-tooltip",
  tooltipFg: "--chart-tooltip-foreground",
  border: "--border",
  foreground: "--foreground",
  mutedForeground: "--muted-foreground",
  surface: "--card",
  success: "--success",
  warning: "--warning",
  danger: "--danger",
  info: "--info",
  neutral: "--neutral",
};

/** "204.4 100% 36.7%" → "hsl(204.4, 100%, 36.7%)". Empty when the variable is missing. */
function channelsToHsl(channels: string): string {
  const parts = channels.trim().split(/\s+/);
  if (parts.length < 3) return "";
  return `hsl(${parts[0]}, ${parts[1]}, ${parts[2]})`;
}

/** Reads the chart tokens from the CSS variables in effect on `element` (default: <html>). */
export function readChartTheme(element?: Element | null): ChartTheme {
  const target = element ?? (typeof document !== "undefined" ? document.documentElement : null);
  const styles = target ? getComputedStyle(target) : null;
  const read = (name: string) => (styles ? channelsToHsl(styles.getPropertyValue(name)) : "") || "currentColor";
  const theme = {
    series: [read("--chart-1"), read("--chart-2"), read("--chart-3"), read("--chart-4"), read("--chart-5")],
  } as ChartTheme;
  for (const [key, variable] of Object.entries(TOKEN) as [Exclude<keyof ChartTheme, "series">, string][]) {
    theme[key] = read(variable);
  }
  return theme;
}

/**
 * Resolved chart colours for the current theme. Re-reads the CSS variables when the theme changes
 * (watches the `class` attribute of <html>, so it is correct even though ThemeProvider toggles the
 * class in an effect that runs after child effects).
 */
export function useChartTheme(): ChartTheme {
  const { theme: mode } = useTheme();
  const [theme, setTheme] = useState<ChartTheme>(() => readChartTheme());

  useEffect(() => {
    setTheme(readChartTheme());
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => setTheme(readChartTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    return () => observer.disconnect();
  }, [mode]);

  return theme;
}

/** Adds transparency to a colour from useChartTheme(): alpha(theme.series[0], 0.15). */
export function alpha(color: string, opacity: number): string {
  const match = /^hsl\((.+)\)$/.exec(color.trim());
  if (!match) return color;
  return `hsla(${match[1]}, ${Math.min(1, Math.max(0, opacity))})`;
}

/* =============================================================================================
 * Presets (spread onto Recharts components)
 * ============================================================================================= */

/** Default chart margin: room for the top tick label, flush left (the Y axis has its own width). */
export const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };

/** XAxis / YAxis: 12px muted ticks, no axis or tick lines. */
export function chartAxisProps(theme: ChartTheme) {
  return {
    tick: { fontSize: 12, fill: theme.axis },
    axisLine: false,
    tickLine: false,
    tickMargin: 8,
  } as const;
}

/** CartesianGrid: light dashed horizontal lines only. */
export function chartGridProps(theme: ChartTheme) {
  return {
    stroke: theme.grid,
    strokeDasharray: "3 3",
    vertical: false,
  } as const;
}

/** Tooltip `cursor`: a faint guide line (line/area charts) or a faint band (bar charts). */
export function chartCursor(theme: ChartTheme, kind: "line" | "bar" = "line") {
  return kind === "bar"
    ? { fill: alpha(theme.axis, 0.08) }
    : { stroke: alpha(theme.axis, 0.45), strokeWidth: 1, strokeDasharray: "3 3" };
}

/** Line/Area active dot that reads on both themes. */
export function chartActiveDot(theme: ChartTheme, color: string) {
  return { r: 4, strokeWidth: 2, stroke: theme.surface, fill: color };
}

/* =============================================================================================
 * Tooltip
 * ============================================================================================= */

/** Subset of a Recharts tooltip payload entry. */
export type ChartTooltipEntry = {
  name?: string | number;
  value?: unknown;
  color?: string;
  fill?: string;
  stroke?: string;
  dataKey?: unknown;
  payload?: unknown;
};

export type ChartTooltipProps = {
  /* Injected by Recharts: */
  active?: boolean;
  payload?: ReadonlyArray<ChartTooltipEntry>;
  label?: unknown;
  /* Yours: */
  /** Formats each value (default: toLocaleString for numbers). */
  valueFormatter?: (value: unknown, name: string, entry: ChartTooltipEntry) => ReactNode;
  /** Formats the heading (the x value). */
  labelFormatter?: (label: unknown, payload: ReadonlyArray<ChartTooltipEntry>) => ReactNode;
  hideLabel?: boolean;
  className?: string;
};

/**
 * Tokenized tooltip body: `<Tooltip content={<ChartTooltip valueFormatter={…} labelFormatter={…} />} />`.
 * Raised surface, border, 12–13px text, series swatch + name + formatted value.
 */
export function ChartTooltip({ active, payload, label, valueFormatter, labelFormatter, hideLabel, className }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const heading = hideLabel ? null : labelFormatter ? labelFormatter(label, payload) : (label as ReactNode);
  return (
    <div
      className={cn(
        "min-w-[9rem] rounded-md border border-border bg-chart-tooltip px-2.5 py-2 text-xs text-chart-tooltip-foreground shadow-md",
        className,
      )}
    >
      {heading != null && heading !== "" && <p className="mb-1.5 font-medium text-chart-tooltip-foreground">{heading}</p>}
      <ul className="space-y-1">
        {payload.map((entry, idx) => {
          const name = String(entry.name ?? entry.dataKey ?? "");
          const swatch = entry.color ?? entry.stroke ?? entry.fill;
          const value = valueFormatter
            ? valueFormatter(entry.value, name, entry)
            : typeof entry.value === "number"
              ? entry.value.toLocaleString("en-US")
              : (entry.value as ReactNode);
          return (
            <li key={`${name}-${idx}`} className="flex items-center gap-2">
              {swatch && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: swatch }} />}
              <span className="text-chart-tooltip-foreground/75">{name}</span>
              <span className="ml-auto pl-3 text-ui font-semibold tabular-nums">{value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* =============================================================================================
 * Legend
 * ============================================================================================= */

export type ChartLegendItem = {
  label: ReactNode;
  /** Colour from useChartTheme(). */
  color: string;
  /** Pre-formatted value ("17,757"). */
  value?: ReactNode;
  /** Secondary text ("96.4%"). */
  hint?: ReactNode;
};

/** HTML legend (swatch + label [+ value / hint]) for charts that need numbers next to the key. */
export function ChartLegend({
  items,
  orientation = "horizontal",
  className,
}: {
  items: ChartLegendItem[];
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "text-ui",
        orientation === "horizontal" ? "flex flex-wrap items-center gap-x-4 gap-y-1" : "flex flex-col gap-2",
        className,
      )}
    >
      {items.map((item, idx) => (
        <li key={idx} className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: item.color }} />
          <span className="min-w-0 truncate text-muted-foreground">{item.label}</span>
          {item.value != null && <span className="ml-auto pl-2 font-semibold tabular-nums text-foreground">{item.value}</span>}
          {item.hint != null && <span className="tabular-nums text-muted-foreground">{item.hint}</span>}
        </li>
      ))}
    </ul>
  );
}

/* =============================================================================================
 * ChartCard
 * ============================================================================================= */

export type ChartCardEmpty = {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export type ChartCardProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Right side of the header (segmented Tabs, a Select, an IconButton …). */
  actions?: ReactNode;
  /** Skeleton in place of the body. */
  loading?: boolean;
  /** Show the empty state instead of children. */
  isEmpty?: boolean;
  /** Empty-state content (default "No data for this period"). Passing it alone does not mark the card empty. */
  empty?: ChartCardEmpty;
  /**
   * Body height in px. Set it for charts (children then fill it, e.g. ResponsiveContainer height="100%").
   * Omit for free-flowing content; loading/empty then use 200px.
   */
  height?: number;
  /** Content under the body (legend, totals). Hidden while loading/empty. */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
};

/** Bordered card with a compact header, a fixed-height chart body, skeleton loading and an empty state. */
export function ChartCard({
  title,
  description,
  actions,
  loading = false,
  isEmpty = false,
  empty,
  height,
  footer,
  children,
  className,
  bodyClassName,
}: ChartCardProps) {
  const placeholderHeight = height ?? 200;
  return (
    <section className={cn("flex min-w-0 flex-col rounded-lg border border-border bg-card text-card-foreground", className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-5 text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className={cn("min-w-0 flex-1 px-5 pb-4", bodyClassName)}>
        {loading ? (
          <div aria-busy="true" style={{ height: placeholderHeight }} className="flex flex-col justify-end gap-2">
            <Skeleton className="h-full w-full" />
          </div>
        ) : isEmpty ? (
          <div style={{ height: placeholderHeight }} className="flex items-center justify-center">
            <EmptyState
              size="sm"
              icon={empty?.icon ?? BarChart3}
              title={empty?.title ?? "No data for this period"}
              description={empty?.description}
              action={empty?.action}
            />
          </div>
        ) : (
          <>
            <div style={height != null ? { height } : undefined} className="min-w-0">
              {children}
            </div>
            {footer && <div className="mt-3">{footer}</div>}
          </>
        )}
      </div>
    </section>
  );
}
