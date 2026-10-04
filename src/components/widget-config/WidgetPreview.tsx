import { useState, type CSSProperties, type ReactNode } from "react";
import { Calculator, LogOut, MapPin, Phone, SendHorizontal, SquarePen } from "lucide-react";
import {
  CALCULATOR_TENOR_OPTIONS,
  CALCULATOR_TYPE_OPTIONS,
  defaultCalculatorLabel,
  type CalculatorProductForm,
  type CalculatorTypeKey,
} from "@/lib/calculatorDefaults";
import { HEX_COLOR_RE, type LocationForm } from "./widget-form";

/*
 * Live preview of the AIVA desktop widget (AIVA-widget: ChatPanel, InstallmentCalculatorPanel,
 * LocationsPanel). The widget is light-only and is NOT part of the console's design system, so —
 * as the one documented exception to the "tokens only" rule — this file reproduces the widget's
 * literal colours, radii and 10–11px meta text. They live in the constants below and are applied
 * with inline styles (never `bg-white` / `text-slate-*` classes, which the console's dark theme
 * would remap). The root is wrapped in `.theme-light`, so the preview looks identical in the
 * console's light and dark modes. Tailwind classes here are layout/spacing only.
 */

/** Default accent of the desktop widget (AIVA-widget `--gochat-rgb: 0 87 168`). Shown by the editor when no brand colour is set. */
export const DEFAULT_WIDGET_ACCENT = "#0057a8";

/** AIVA-widget palette (Tailwind slate + the widget's `widget` / `widget-strong` borders). */
const W = {
  white: "#ffffff",
  slate50: "#f8fafc",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate300: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",
  rose600: "#e11d48",
  /** border-widget */
  line: "#cbd5e1",
  /** border-widget-strong */
  lineStrong: "#94a3b8",
} as const;

/** Tailwind default radii used by the widget (the console overrides these scale steps). */
const R = { md: 6, lg: 8, xl: 12, x2: 16, full: 9999 } as const;

/** Widget meta text sizes (px). */
const FS = { meta: 10, chip: 11 } as const;

const SHADOW_WIDGET_LG = "0 18px 50px rgba(15, 23, 42, 0.16), 0 6px 16px rgba(0, 87, 168, 0.1), 0 0 0 1px rgba(15, 23, 42, 0.04)";
const SHADOW_SM = "0 1px 2px 0 rgba(0, 0, 0, 0.05)";

// ---------------------------------------------------------------------------------------------
// Accent shades — mirror AIVA-widget accentCssVars (dark = 28% toward black, light = 14% toward white).
// ---------------------------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return null;
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade([r, g, b]: [number, number, number], target: number, amt: number): string {
  const m = (c: number) => Math.round(c + (target - c) * amt);
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}

function accentShades(accent: string) {
  const rgb = hexToRgb(HEX_COLOR_RE.test(accent) ? accent : DEFAULT_WIDGET_ACCENT) ?? [0, 87, 168];
  return {
    base: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
    dark: shade(rgb, 0, 0.28),
    light: shade(rgb, 255, 0.14),
    soft: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.1)`,
  };
}

// ---------------------------------------------------------------------------------------------
// Preview-only installment math — mirrors AIVA-widget/utils/installmentCalculator.ts
// (declining-balance for APR products, flat-rate for instant approval).
// ---------------------------------------------------------------------------------------------

type PreviewRow = { months: number; installment: number; interest: number; flatPct: number };

function amortizedInstallment(principal: number, apr: number, months: number): number {
  const r = apr / 12;
  if (r === 0) return Math.round(principal / months);
  const factor = Math.pow(1 + r, months);
  return Math.round((principal * r * factor) / (factor - 1));
}

function parsePositive(raw: string): number | null {
  const n = Number.parseFloat((raw ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function computePreviewRows(
  opt: (typeof CALCULATOR_TYPE_OPTIONS)[number],
  product: CalculatorProductForm,
  principal: number,
): PreviewRow[] {
  const tenors = (product.tenors.length > 0 ? [...product.tenors] : [...CALCULATOR_TENOR_OPTIONS]).sort((a, b) => a - b);
  const rows: PreviewRow[] = [];
  for (const months of tenors) {
    if (opt.usesApr) {
      const apr = parsePositive(product.aprPercent);
      if (apr == null) continue;
      const installment = amortizedInstallment(principal, apr / 100, months);
      const interest = installment * months - principal;
      const flatPct = Math.round((interest / (principal * months)) * 10_000) / 100;
      rows.push({ months, installment, interest, flatPct });
    } else {
      const flat = parsePositive(product.flatRatePercents[String(months)] ?? "");
      if (flat == null) continue;
      const dec = flat / 100;
      const interest = Math.round(principal * dec * months);
      const installment = Math.round((principal + interest) / months);
      rows.push({ months, installment, interest, flatPct: dec * 100 });
    }
  }
  return rows;
}

const egp = (n: number) => n.toLocaleString("en-US");

// ---------------------------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------------------------

/** Rounded header icon button (ChatPanel `headerIconBtn`, compacted to 32px for the preview). */
function HeaderIcon({
  children,
  active,
  accent,
  onClick,
  label,
}: {
  children: ReactNode;
  active?: boolean;
  accent: ReturnType<typeof accentShades>;
  onClick?: () => void;
  label: string;
}) {
  const style: CSSProperties = {
    borderRadius: R.lg,
    border: `1px solid ${active ? accent.base : W.slate300}`,
    backgroundColor: active ? accent.soft : W.white,
    color: active ? accent.base : W.slate600,
  };
  const className = "inline-flex h-8 w-8 shrink-0 items-center justify-center";
  if (!onClick) {
    return (
      <span aria-hidden="true" className={className} style={style}>
        {children}
      </span>
    );
  }
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={active} className={className} style={style}>
      {children}
    </button>
  );
}

/** Frameless window controls (WindowChromeButtons): − and ×, borderless, slate-500. */
function WindowChrome() {
  const style: CSSProperties = { borderRadius: R.md, color: W.slate500 };
  return (
    <span aria-hidden="true" className="flex items-center gap-0.5">
      <span className="flex h-8 w-8 items-center justify-center" style={style}>
        <svg width="12" height="3" viewBox="0 0 12 2">
          <rect width="12" height="2" rx="0.5" fill="currentColor" />
        </svg>
      </span>
      <span className="flex h-8 w-8 items-center justify-center" style={style}>
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    </span>
  );
}

function BackToChat({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 px-2.5 py-1.5 text-xs font-medium"
      style={{ borderRadius: R.lg, border: `1px solid ${W.slate300}`, backgroundColor: W.white, color: W.slate600 }}
    >
      Back to chat
    </button>
  );
}

function PanelHeading({ title, meta, onBack, children }: { title: string; meta: string; onBack: () => void; children?: ReactNode }) {
  return (
    <div className="shrink-0 px-3.5 py-2.5" style={{ borderBottom: `1px solid ${W.lineStrong}` }}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: W.slate900 }}>
            {title}
          </p>
          <p style={{ fontSize: FS.meta, lineHeight: "14px", color: W.slate500 }}>{meta}</p>
        </div>
        <BackToChat onClick={onBack} />
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// WidgetPreview
// ---------------------------------------------------------------------------------------------

export type WidgetPreviewPanel = "chat" | "calculator" | "locations";

export type WidgetPreviewProps = {
  accountName: string;
  /** Raw form values; the widget's defaults are used when blank. */
  title: string;
  subtitle: string;
  accentColor: string;
  logoUrl: string;
  /** KB buttons shown in the widget's KB row (empty = row hidden). */
  kbButtons: { key: string; label: string }[];
  calculator: {
    enabled: boolean;
    types: CalculatorTypeKey[];
    products: Record<CalculatorTypeKey, CalculatorProductForm>;
  };
  locations: { enabled: boolean; items: LocationForm[] };
  /** Which widget view is open (the header buttons toggle it, like the real widget). */
  panel: WidgetPreviewPanel;
  onPanelChange: (panel: WidgetPreviewPanel) => void;
  className?: string;
};

/**
 * The desktop widget as agents see it, driven by the unsaved form values. Keep in sync with
 * AIVA-widget; do not restyle it with console tokens.
 */
export function WidgetPreview({
  accountName,
  title,
  subtitle,
  accentColor,
  logoUrl,
  kbButtons,
  calculator,
  locations,
  panel,
  onPanelChange,
  className,
}: WidgetPreviewProps) {
  const [principalInput, setPrincipalInput] = useState("10000");
  const [previewType, setPreviewType] = useState<CalculatorTypeKey | null>(null);

  const accent = accentShades(accentColor || DEFAULT_WIDGET_ACCENT);
  const previewTitle = title.trim() || "GoChat247";
  const previewSubtitle = subtitle.trim() || "AI assistant";
  const logo = logoUrl.trim() || "/GoChat247_blue_transparent.png";

  const productLabel = (key: CalculatorTypeKey) => calculator.products[key]?.label.trim() || defaultCalculatorLabel(key);

  const enabledTypes = calculator.enabled ? calculator.types : [];
  const activeType = previewType && enabledTypes.includes(previewType) ? previewType : (enabledTypes[0] ?? null);
  const activeOption = CALCULATOR_TYPE_OPTIONS.find((o) => o.key === activeType);
  const calcOpen = panel === "calculator" && calculator.enabled && activeOption != null;
  const previewLocations = locations.items.filter((l) => l.name.trim());
  const locOpen = panel === "locations" && locations.enabled && !calcOpen;
  const principal = parsePositive(principalInput);
  const rows =
    calcOpen && activeOption && principal != null
      ? computePreviewRows(activeOption, calculator.products[activeOption.key as CalculatorTypeKey], principal)
      : [];

  const chipStyle: CSSProperties = {
    borderRadius: R.full,
    border: `1px solid ${accent.base}`,
    backgroundColor: accent.soft,
    color: accent.base,
  };

  return (
    <div
      className={["theme-light flex h-[460px] w-full max-w-[360px] flex-col overflow-hidden text-left", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        borderRadius: R.x2,
        border: `2px solid ${W.lineStrong}`,
        backgroundColor: W.white,
        color: W.slate900,
        boxShadow: SHADOW_WIDGET_LG,
        fontFamily: "Inter, 'Noto Sans Arabic', 'Segoe UI', Tahoma, system-ui, sans-serif",
      }}
    >
      {/* accent bar (bg-gradient-to-r from-gochat-dark via-gochat to-gochat-light) */}
      <div
        aria-hidden="true"
        className="h-1 shrink-0"
        style={{ background: `linear-gradient(to right, ${accent.dark}, ${accent.base}, ${accent.light})` }}
      />

      {/* header */}
      <div
        className="flex shrink-0 items-center gap-3 px-3.5 py-2.5"
        style={{ borderBottom: `1px solid ${W.line}`, backgroundColor: W.white }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden p-0.5"
            style={{ borderRadius: R.xl, border: `2px solid ${W.lineStrong}`, backgroundColor: W.white }}
          >
            <img src={logo} alt="" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight" style={{ color: W.slate900 }}>
              <span dir="auto">{previewTitle}</span>
            </p>
            <p className="truncate font-medium" style={{ fontSize: FS.meta, lineHeight: "14px", color: accent.base }}>
              <span dir="auto">
                {accountName} · {previewSubtitle}
              </span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {calculator.enabled && (
            <HeaderIcon
              accent={accent}
              active={calcOpen}
              label={calcOpen ? "Back to chat" : "Installment calculator"}
              onClick={() => onPanelChange(calcOpen ? "chat" : "calculator")}
            >
              <Calculator aria-hidden="true" className="h-[18px] w-[18px]" />
            </HeaderIcon>
          )}
          {locations.enabled && (
            <HeaderIcon
              accent={accent}
              active={locOpen}
              label={locOpen ? "Back to chat" : "Locations"}
              onClick={() => onPanelChange(locOpen ? "chat" : "locations")}
            >
              <MapPin aria-hidden="true" className="h-[18px] w-[18px]" />
            </HeaderIcon>
          )}
          <HeaderIcon accent={accent} label="New chat">
            <SquarePen className="h-[18px] w-[18px]" />
          </HeaderIcon>
          <HeaderIcon accent={accent} label="Sign out">
            <LogOut className="h-[18px] w-[18px]" />
          </HeaderIcon>
          <span className="ml-0.5 pl-1" style={{ borderLeft: `1px solid ${W.lineStrong}` }}>
            <WindowChrome />
          </span>
        </div>
      </div>

      {/* KB row */}
      {kbButtons.length > 0 && (
        <div
          className="flex shrink-0 flex-wrap items-center gap-1.5 px-3 py-2"
          style={{ borderBottom: `1px solid ${W.slate200}`, backgroundColor: W.slate50 }}
        >
          <span className="font-semibold uppercase tracking-wide" style={{ fontSize: FS.meta, color: W.slate500 }}>
            KB
          </span>
          {kbButtons.map((q) => (
            <span key={q.key} className="px-2.5 py-0.5 font-medium" style={{ ...chipStyle, fontSize: FS.chip, lineHeight: "16px" }}>
              <span dir="auto">{q.label}</span>
            </span>
          ))}
        </div>
      )}

      {calcOpen && activeOption ? (
        /* InstallmentCalculatorPanel */
        <div className="flex min-h-0 flex-1 flex-col">
          <PanelHeading title="Installment calculator" meta="Approximate values for agents" onBack={() => onPanelChange("chat")}>
            <div className="mt-2.5 flex gap-1">
              {enabledTypes.map((key) => {
                const active = activeType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPreviewType(key)}
                    aria-pressed={active}
                    className="flex-1 px-2 py-2 text-center font-medium leading-tight"
                    style={{
                      fontSize: FS.chip,
                      borderRadius: R.lg,
                      border: `1px solid ${active ? accent.base : W.slate300}`,
                      backgroundColor: active ? accent.soft : W.white,
                      color: active ? accent.dark : W.slate600,
                    }}
                  >
                    <span dir="auto">{productLabel(key)}</span>
                  </button>
                );
              })}
            </div>
          </PanelHeading>

          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium" style={{ color: W.slate700 }}>
                Principal (EGP)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={principalInput}
                onChange={(e) => setPrincipalInput(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full px-3 py-2.5 text-sm outline-none"
                style={{ borderRadius: R.xl, border: `1px solid ${W.slate400}`, backgroundColor: W.white, color: W.slate900 }}
              />
            </label>
            {principal == null && principalInput.trim() !== "" && (
              <p className="mt-2 text-xs" style={{ color: W.rose600 }}>
                Enter a valid amount greater than zero.
              </p>
            )}
            {rows.length > 0 && (
              <div className="mt-3 overflow-hidden" style={{ borderRadius: R.xl, border: `1px solid ${W.lineStrong}` }}>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr
                      className="font-semibold uppercase tracking-wide"
                      style={{ fontSize: FS.meta, color: W.slate600, backgroundColor: W.slate50, borderBottom: `1px solid ${W.lineStrong}` }}
                    >
                      <th className="px-2.5 py-2">Months</th>
                      <th className="px-2.5 py-2 text-right">Installment</th>
                      <th className="px-2.5 py-2 text-right">Interest</th>
                      <th className="px-2.5 py-2 text-right">Flat rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={row.months}
                        style={{
                          backgroundColor: i % 2 === 0 ? W.white : "rgba(248, 250, 252, 0.6)",
                          borderBottom: i === rows.length - 1 ? undefined : `1px solid ${W.slate100}`,
                        }}
                      >
                        <td className="px-2.5 py-2 font-medium" style={{ color: W.slate800 }}>
                          {row.months}
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums" style={{ color: W.slate900 }}>
                          {egp(row.installment)}
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums" style={{ color: W.slate700 }}>
                          {egp(row.interest)}
                        </td>
                        <td className="px-2.5 py-2 text-right tabular-nums" style={{ color: W.slate600 }}>
                          {row.flatPct.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 leading-relaxed" style={{ fontSize: FS.meta, color: W.slate500 }}>
              <bdi>تقريبياً</bdi> — share amounts as approximate with the customer.
            </p>
          </div>
        </div>
      ) : locOpen ? (
        /* LocationsPanel */
        <div className="flex min-h-0 flex-1 flex-col">
          <PanelHeading
            title="Our locations"
            meta={`${previewLocations.length} branch${previewLocations.length === 1 ? "" : "es"}`}
            onBack={() => onPanelChange("chat")}
          />
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3.5 py-3">
            {previewLocations.length === 0 && (
              <p className="py-8 text-center text-xs" style={{ color: W.slate500 }}>
                No locations available.
              </p>
            )}
            {previewLocations.map((loc, i) => (
              <div key={i} className="p-3" style={{ borderRadius: R.xl, border: `1px solid ${W.slate300}`, backgroundColor: W.white }}>
                <div className="flex items-start justify-between gap-2">
                  <p dir="auto" className="min-w-0 text-sm font-semibold" style={{ color: W.slate900 }}>
                    {loc.name}
                  </p>
                  {loc.area.trim() && (
                    <span dir="auto" className="shrink-0 px-2 py-0.5 font-medium" style={{ ...chipStyle, fontSize: FS.meta }}>
                      {loc.area}
                    </span>
                  )}
                </div>
                {loc.address.trim() && (
                  <p dir="auto" className="mt-1 text-xs leading-relaxed" style={{ color: W.slate600 }}>
                    {loc.address}
                  </p>
                )}
                {(loc.phone.trim() || loc.hours.trim()) && (
                  <p dir="auto" className="mt-1" style={{ fontSize: FS.chip, color: W.slate500 }}>
                    {[loc.phone.trim(), loc.hours.trim()].filter(Boolean).join(" · ")}
                  </p>
                )}
                {loc.mapsUrl.trim() && (
                  <span className="mt-1.5 inline-flex items-center gap-1 font-medium" style={{ fontSize: FS.chip, color: accent.base }}>
                    <MapPin aria-hidden="true" className="h-3 w-3" /> Open in Maps
                  </span>
                )}
              </div>
            ))}
            {previewLocations.some((l) => l.phone.trim()) && (
              <p className="pt-1 text-center" style={{ fontSize: FS.meta, color: W.slate500 }}>
                <Phone aria-hidden="true" className="mr-1 inline h-3 w-3" />
                Call the hotline to find your nearest branch.
              </p>
            )}
          </div>
        </div>
      ) : (
        /* chat empty state */
        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3" style={{ backgroundColor: W.white }}>
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div
              className="mb-3 flex h-14 w-14 items-center justify-center overflow-hidden p-1.5"
              style={{ borderRadius: R.x2, border: `2px solid ${W.lineStrong}`, backgroundColor: W.white, boxShadow: SHADOW_SM }}
            >
              <img src={logo} alt="" className="h-full w-full object-contain" />
            </div>
            <p className="text-sm font-medium" style={{ color: W.slate800 }}>
              How can I help?
            </p>
            <p className="mt-1 max-w-[16rem] text-xs leading-relaxed" style={{ color: W.slate600 }}>
              Ask a question about your knowledge base or start a new topic.
            </p>
          </div>
        </div>
      )}

      {/* composer (hidden while the calculator is open, like the widget) */}
      {!calcOpen && (
        <div className="shrink-0 px-3 pb-3 pt-2.5" style={{ borderTop: `1px solid ${W.lineStrong}`, backgroundColor: W.white }}>
          <div
            className="flex items-end gap-2 p-1.5"
            style={{ borderRadius: R.x2, border: `1px solid ${W.slate400}`, backgroundColor: W.white, boxShadow: SHADOW_SM }}
          >
            <span className="flex-1 px-2.5 py-2 text-sm" style={{ color: W.slate400 }}>
              Ask anything…
            </span>
            <span
              aria-hidden="true"
              className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center"
              style={{ borderRadius: R.xl, border: `1px solid ${accent.dark}`, backgroundColor: accent.base, color: W.white }}
            >
              <SendHorizontal className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-1.5 text-center" style={{ fontSize: FS.meta, color: W.slate500 }}>
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      )}
    </div>
  );
}
