export const CALCULATOR_TYPE_OPTIONS = [
  { key: "cash-it", label: "Cash it", usesApr: true },
  { key: "instant-approval", label: "Instant Approval", usesApr: false },
  { key: "branches", label: "Branches", usesApr: true },
] as const;

export type CalculatorTypeKey = (typeof CALCULATOR_TYPE_OPTIONS)[number]["key"];

export const ALL_CALCULATOR_TYPES = CALCULATOR_TYPE_OPTIONS.map((o) => o.key);

export const CALCULATOR_TENOR_OPTIONS = [6, 9, 12, 18, 24, 30, 36] as const;

export const DEFAULT_APR_BY_TYPE: Record<string, number> = {
  "cash-it": 0.55,
  branches: 0.52,
};

export const DEFAULT_INSTANT_FLAT_RATES: Record<string, number> = {
  "6": 0.0314,
  "9": 0.0285,
  "12": 0.0248,
  "18": 0.0251,
  "24": 0.025,
  "30": 0.0305,
  "36": 0.0327,
};

export type CalculatorProductForm = {
  /** Custom display name; empty string means "use the default label". */
  label: string;
  aprPercent: string;
  tenors: number[];
  flatRatePercents: Record<string, string>;
};

/** Default display name for a product type (shown as placeholder when label is empty). */
export function defaultCalculatorLabel(type: CalculatorTypeKey): string {
  return CALCULATOR_TYPE_OPTIONS.find((o) => o.key === type)?.label ?? type;
}

export function defaultCalculatorProductForm(type: CalculatorTypeKey): CalculatorProductForm {
  const flatRatePercents: Record<string, string> = {};
  for (const [month, rate] of Object.entries(DEFAULT_INSTANT_FLAT_RATES)) {
    flatRatePercents[month] = (rate * 100).toFixed(2);
  }
  const apr = DEFAULT_APR_BY_TYPE[type];
  return {
    label: "",
    aprPercent: apr != null ? String(Math.round(apr * 1000) / 10) : "",
    tenors: [...CALCULATOR_TENOR_OPTIONS],
    flatRatePercents,
  };
}

export function defaultCalculatorProductsForm(): Record<CalculatorTypeKey, CalculatorProductForm> {
  return {
    "cash-it": defaultCalculatorProductForm("cash-it"),
    "instant-approval": defaultCalculatorProductForm("instant-approval"),
    branches: defaultCalculatorProductForm("branches"),
  };
}

function parseAprPercent(raw: string): number | undefined {
  const n = Number.parseFloat(raw.trim());
  if (!Number.isFinite(n) || n <= 0 || n > 200) return undefined;
  return n / 100;
}

function parseFlatRatePercent(raw: string): number | undefined {
  const n = Number.parseFloat(raw.trim());
  if (!Number.isFinite(n) || n <= 0 || n > 100) return undefined;
  return n / 100;
}

export function calculatorProductsFromAccount(
  _types: string[],
  products: Record<string, { label?: string | null; apr?: number | null; tenors?: number[] | null; flat_rates?: Record<string, number> | null }> | null | undefined,
): Record<CalculatorTypeKey, CalculatorProductForm> {
  const out = defaultCalculatorProductsForm();
  for (const type of ALL_CALCULATOR_TYPES) {
    const saved = products?.[type];
    if (!saved) continue;
    if (typeof saved.label === "string" && saved.label.trim()) {
      out[type].label = saved.label.trim();
    }
    if (saved.apr != null && Number.isFinite(saved.apr)) {
      out[type].aprPercent = String(Math.round(saved.apr * 1000) / 10);
    }
    if (Array.isArray(saved.tenors) && saved.tenors.length > 0) {
      out[type].tenors = saved.tenors.filter((t) =>
        (CALCULATOR_TENOR_OPTIONS as readonly number[]).includes(t),
      );
    }
    if (saved.flat_rates) {
      for (const month of CALCULATOR_TENOR_OPTIONS) {
        const rate = saved.flat_rates[String(month)];
        if (rate != null && Number.isFinite(rate)) {
          out[type].flatRatePercents[String(month)] = (rate * 100).toFixed(2);
        }
      }
    }
  }
  return out;
}

export function buildCalculatorProductsPayload(
  enabledTypes: string[],
  products: Record<CalculatorTypeKey, CalculatorProductForm>,
): Record<string, { label?: string; apr?: number; tenors: number[]; flat_rates?: Record<string, number> }> {
  const out: Record<string, { label?: string; apr?: number; tenors: number[]; flat_rates?: Record<string, number> }> = {};
  for (const type of enabledTypes) {
    const key = type as CalculatorTypeKey;
    const form = products[key] ?? defaultCalculatorProductForm(key);
    const tenors = form.tenors.length > 0 ? form.tenors : [...CALCULATOR_TENOR_OPTIONS];
    const entry: { label?: string; apr?: number; tenors: number[]; flat_rates?: Record<string, number> } = { tenors };
    const label = form.label.trim();
    if (label) entry.label = label;
    const option = CALCULATOR_TYPE_OPTIONS.find((o) => o.key === key);
    if (option?.usesApr) {
      const apr = parseAprPercent(form.aprPercent);
      if (apr != null) entry.apr = apr;
    } else {
      const flat_rates: Record<string, number> = {};
      for (const month of tenors) {
        const rate = parseFlatRatePercent(form.flatRatePercents[String(month)] ?? "");
        if (rate != null) flat_rates[String(month)] = rate;
      }
      if (Object.keys(flat_rates).length > 0) entry.flat_rates = flat_rates;
    }
    out[key] = entry;
  }
  return out;
}
