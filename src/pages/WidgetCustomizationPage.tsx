import { useEffect, useMemo, useState } from "react";
import { Calculator, Check, LogOut, Minus, SendHorizontal, SlidersHorizontal, SquarePen, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/roles";
import { formatUserError } from "@/lib/errors";
import { useAccounts, useAccountKbQueues, useUpdateAccount } from "@/hooks/useAccounts";
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  ALL_CALCULATOR_TYPES,
  buildCalculatorProductsPayload,
  CALCULATOR_TENOR_OPTIONS,
  CALCULATOR_TYPE_OPTIONS,
  calculatorProductsFromAccount,
  defaultCalculatorLabel,
  type CalculatorProductForm,
  type CalculatorTypeKey,
} from "@/lib/calculatorDefaults";
import type { Account, KbQueueGroup, WidgetFeatures } from "@/types/api";

// ---------------------------------------------------------------------------
// Preview-only installment math — mirrors AIVA-widget/utils/installmentCalculator.ts
// (declining-balance for APR products, flat-rate for instant approval). Kept
// local because the widget is a separate app we can't import from.
// ---------------------------------------------------------------------------
type PreviewRow = { months: number; installment: number; interest: number; flatPct: number };

function amortizedInstallment(principal: number, apr: number, months: number): number {
  const r = apr / 12;
  if (r === 0) return Math.round(principal / months);
  const factor = Math.pow(1 + r, months);
  return Math.round((principal * r * factor) / (factor - 1));
}

function parsePercent(raw: string): number | null {
  const n = Number.parseFloat((raw ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function computePreviewRows(
  opt: (typeof CALCULATOR_TYPE_OPTIONS)[number],
  product: CalculatorProductForm,
  principal: number,
): PreviewRow[] {
  const tenors = (product.tenors.length > 0 ? [...product.tenors] : [...CALCULATOR_TENOR_OPTIONS]).sort(
    (a, b) => a - b,
  );
  const rows: PreviewRow[] = [];
  for (const months of tenors) {
    if (opt.usesApr) {
      const apr = parsePercent(product.aprPercent);
      if (apr == null) continue;
      const installment = amortizedInstallment(principal, apr / 100, months);
      const interest = installment * months - principal;
      const flatPct = Math.round((interest / (principal * months)) * 10_000) / 100;
      rows.push({ months, installment, interest, flatPct });
    } else {
      const flat = parsePercent(product.flatRatePercents[String(months)] ?? "");
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

// ---------------------------------------------------------------------------
// Form helpers
// ---------------------------------------------------------------------------
function calculatorTypesFromAccount(acc: Account | null): CalculatorTypeKey[] {
  const types = acc?.widget_features?.installment_calculator?.types;
  if (Array.isArray(types) && types.length > 0) {
    return types.filter((t): t is CalculatorTypeKey =>
      ALL_CALCULATOR_TYPES.includes(t as CalculatorTypeKey),
    );
  }
  return [...ALL_CALCULATOR_TYPES];
}

type WidgetForm = {
  calcEnabled: boolean;
  calcTypes: CalculatorTypeKey[];
  calcProducts: Record<CalculatorTypeKey, CalculatorProductForm>;
  kbOverride: boolean;
  kbVisibleKeys: string[];
};

function formFromAccount(acc: Account | null): WidgetForm {
  const calc = acc?.widget_features?.installment_calculator;
  const kb = acc?.widget_features?.kb_queues;
  const kbOverride = kb != null && Array.isArray(kb.visible_keys);
  return {
    calcEnabled: calc?.enabled ?? false,
    calcTypes: calculatorTypesFromAccount(acc),
    calcProducts: calculatorProductsFromAccount(
      calc?.types ?? [],
      calc?.products,
    ),
    kbOverride,
    kbVisibleKeys: kbOverride ? [...(kb!.visible_keys as string[])] : [],
  };
}

function buildWidgetFeatures(form: WidgetForm): WidgetFeatures {
  const activeTypes = form.calcEnabled ? form.calcTypes : [];
  const wf: WidgetFeatures = {
    installment_calculator: {
      enabled: form.calcEnabled,
      types: activeTypes,
      products: form.calcEnabled
        ? buildCalculatorProductsPayload(activeTypes, form.calcProducts)
        : undefined,
    },
    // null clears the override (widget shows every allowed KB button).
    kb_queues: form.kbOverride ? { visible_keys: form.kbVisibleKeys } : null,
  };
  return wf;
}

// Shared class for the widget header's round icon buttons (mirrors ChatPanel).
const headerIconBtn =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600";

export function WidgetCustomizationPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts(
    isSuperAdmin ? null : user?.organization_id,
  );
  const updateAccount = useUpdateAccount();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedId) ?? null,
    [accounts, selectedId],
  );

  const { data: kbCatalog = [] } = useAccountKbQueues(selectedId);

  const [form, setForm] = useState<WidgetForm>(() => formFromAccount(null));
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Preview mirrors the real widget: the calculator button opens the panel.
  const [previewCalcOpen, setPreviewCalcOpen] = useState(false);
  const [previewPrincipal, setPreviewPrincipal] = useState("10000");
  const [previewType, setPreviewType] = useState<CalculatorTypeKey | null>(null);

  // Default to the first account once loaded.
  useEffect(() => {
    if (selectedId == null && accounts.length > 0) setSelectedId(accounts[0].id);
  }, [accounts, selectedId]);

  // Reset the form whenever the selected account changes.
  useEffect(() => {
    setForm(formFromAccount(selectedAccount));
    setError(null);
    setSavedAt(null);
    setPreviewCalcOpen(false);
    setPreviewPrincipal("10000");
  }, [selectedAccount]);

  const patch = <K extends keyof WidgetForm>(key: K, value: WidgetForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function setProduct(typeKey: CalculatorTypeKey, next: CalculatorProductForm) {
    setForm((f) => ({
      ...f,
      calcProducts: { ...f.calcProducts, [typeKey]: next },
    }));
  }

  async function handleSave() {
    if (!selectedAccount) return;
    setError(null);
    setSavedAt(null);
    try {
      await updateAccount.mutateAsync({
        id: selectedAccount.id,
        body: { widget_features: buildWidgetFeatures(form) },
      });
      setSavedAt(Date.now());
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  // KB buttons shown in the preview: override list, else the whole catalog.
  const previewKbKeys = form.kbOverride
    ? form.kbVisibleKeys
    : kbCatalog.map((q) => q.key);
  const kbLabel = (key: string) =>
    kbCatalog.find((q) => q.key === key)?.label ?? key;

  // Display name for a calculator product: custom label, else the default.
  const productLabel = (key: CalculatorTypeKey) =>
    form.calcProducts[key]?.label.trim() || defaultCalculatorLabel(key);

  // Derived preview values (kept valid without extra effects).
  const enabledTypes = form.calcEnabled ? form.calcTypes : [];
  const activePreviewType =
    previewType && enabledTypes.includes(previewType) ? previewType : enabledTypes[0] ?? null;
  const activePreviewOption = CALCULATOR_TYPE_OPTIONS.find((o) => o.key === activePreviewType);
  const calcPanelOpen = previewCalcOpen && form.calcEnabled;
  const principalValue = parsePercent(previewPrincipal);
  const previewRows =
    calcPanelOpen && activePreviewOption && principalValue != null
      ? computePreviewRows(
          activePreviewOption,
          form.calcProducts[activePreviewOption.key as CalculatorTypeKey],
          principalValue,
        )
      : [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={SlidersHorizontal}
        title="Widget customization"
        description="Turn widget features on or off and edit their values per account — no code needed."
        actions={
          <div className="flex items-center gap-2">
            <Label className="hidden text-xs text-muted-foreground sm:block">Account</Label>
            <Select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
              className="min-w-[200px]"
              disabled={accountsLoading || accounts.length === 0}
            >
              {accounts.length === 0 && <option value="">No accounts</option>}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {selectedAccount == null ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {accountsLoading ? "Loading accounts…" : "Select an account to customize its widget."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          {/* ---------------- Controls ---------------- */}
          <div className="space-y-6">
            <ErrorAlert message={error} />

            {/* Installment calculator */}
            <section className="rounded-xl border border-border bg-card p-5">
              <label className="flex cursor-pointer items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold text-slate-800">Installment calculator</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Shows a loan/installment calculator button in the widget.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={form.calcEnabled}
                  onChange={(e) => patch("calcEnabled", e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300"
                />
              </label>

              {form.calcEnabled && (
                <div className="mt-4 space-y-3">
                  {CALCULATOR_TYPE_OPTIONS.map((opt) => {
                    const typeKey = opt.key as CalculatorTypeKey;
                    const on = form.calcTypes.includes(typeKey);
                    const product = form.calcProducts[typeKey];
                    return (
                      <div key={opt.key} className="rounded-lg border border-slate-200 bg-white p-3">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => {
                              const next = on
                                ? form.calcTypes.filter((t) => t !== typeKey)
                                : [...form.calcTypes, typeKey];
                              if (next.length === 0) return; // keep at least one product
                              patch("calcTypes", next);
                            }}
                            className="h-3.5 w-3.5 rounded border-slate-300"
                          />
                          <span className="text-sm font-medium text-slate-800">{productLabel(typeKey)}</span>
                          {productLabel(typeKey) !== opt.label && (
                            <span className="text-[11px] text-slate-400">({opt.label})</span>
                          )}
                        </label>

                        {on && (
                          <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                            <div>
                              <Label className="text-xs">Display name</Label>
                              <Input
                                value={product.label}
                                onChange={(e) => setProduct(typeKey, { ...product, label: e.target.value })}
                                placeholder={defaultCalculatorLabel(typeKey)}
                                className="mt-1 h-9"
                              />
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                Shown as the tab name in the widget. Leave blank to use "{defaultCalculatorLabel(typeKey)}".
                              </p>
                            </div>
                            {opt.usesApr && (
                              <div>
                                <Label className="text-xs">APR (%)</Label>
                                <Input
                                  value={product.aprPercent}
                                  onChange={(e) =>
                                    setProduct(typeKey, { ...product, aprPercent: e.target.value })
                                  }
                                  placeholder="55"
                                  className="mt-1 h-9"
                                />
                              </div>
                            )}
                            <div>
                              <Label className="text-xs">Tenors (months)</Label>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {CALCULATOR_TENOR_OPTIONS.map((month) => {
                                  const tenorOn = product.tenors.includes(month);
                                  return (
                                    <button
                                      key={month}
                                      type="button"
                                      onClick={() => {
                                        const nextTenors = tenorOn
                                          ? product.tenors.filter((t) => t !== month)
                                          : [...product.tenors, month];
                                        if (nextTenors.length === 0) return;
                                        setProduct(typeKey, { ...product, tenors: nextTenors });
                                      }}
                                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                        tenorOn
                                          ? "border-gochat bg-gochat/10 text-gochat"
                                          : "border-slate-300 bg-slate-50 text-slate-600"
                                      }`}
                                    >
                                      {month}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            {!opt.usesApr && (
                              <div>
                                <Label className="text-xs">Flat rate per month (%)</Label>
                                <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                  {product.tenors.map((month) => (
                                    <div key={month}>
                                      <span className="text-[10px] text-muted-foreground">{month} mo</span>
                                      <Input
                                        value={product.flatRatePercents[String(month)] ?? ""}
                                        onChange={(e) =>
                                          setProduct(typeKey, {
                                            ...product,
                                            flatRatePercents: {
                                              ...product.flatRatePercents,
                                              [String(month)]: e.target.value,
                                            },
                                          })
                                        }
                                        className="mt-0.5 h-8 text-xs"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* KB buttons */}
            <section className="rounded-xl border border-border bg-card p-5">
              <label className="flex cursor-pointer items-start justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold text-slate-800">KB buttons</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Choose which knowledge-base buttons this account's widget shows.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={form.kbOverride}
                  onChange={(e) => {
                    const on = e.target.checked;
                    // When first turning the override on, start with everything visible.
                    patch("kbOverride", on);
                    if (on && form.kbVisibleKeys.length === 0) {
                      patch("kbVisibleKeys", kbCatalog.map((q) => q.key));
                    }
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300"
                  disabled={kbCatalog.length === 0}
                />
              </label>

              {kbCatalog.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  This account has no knowledge base configured, so there are no KB buttons to manage.
                </p>
              ) : !form.kbOverride ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Showing all buttons the account/agent allows ({kbCatalog.length}). Turn on to restrict.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {kbCatalog.map((q: KbQueueGroup) => {
                    const checked = form.kbVisibleKeys.includes(q.key);
                    return (
                      <button
                        key={q.key}
                        type="button"
                        onClick={() =>
                          patch(
                            "kbVisibleKeys",
                            checked
                              ? form.kbVisibleKeys.filter((k) => k !== q.key)
                              : [...form.kbVisibleKeys, q.key],
                          )
                        }
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          checked
                            ? "border-gochat bg-gochat/10 text-gochat"
                            : "border-slate-300 bg-slate-50 text-slate-500"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                        {q.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {form.kbOverride && form.kbVisibleKeys.length === 0 && kbCatalog.length > 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  No buttons selected — the widget will show no KB buttons for this account.
                </p>
              )}
            </section>

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={updateAccount.isPending}>
                {updateAccount.isPending ? "Saving…" : "Save changes"}
              </Button>
              {savedAt != null && (
                <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
                  <Check className="h-4 w-4" /> Saved
                </span>
              )}
            </div>
          </div>

          {/* ---------------- Live preview (mirrors the real widget) ---------------- */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Live preview</p>
            <div className="mx-auto flex h-[460px] w-full max-w-[360px] flex-col overflow-hidden rounded-2xl border-2 border-[#94a3b8] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.16),0_6px_16px_rgba(0,87,168,0.1)]">
              {/* gradient accent bar */}
              <div className="h-1 shrink-0 bg-gradient-to-r from-[#003D75] via-[#0057A8] to-[#0066C0]" />

              {/* header */}
              <header className="flex shrink-0 items-center gap-3 border-b border-[#cbd5e1] bg-white px-3.5 py-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-[#94a3b8] bg-white p-0.5">
                    <img src="/GoChat247_blue_transparent.png" alt="" className="h-full w-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold tracking-tight text-slate-900">GoChat247</p>
                    <p className="truncate text-[10px] font-medium text-[#0057A8]">
                      {selectedAccount.name} · AI assistant
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {form.calcEnabled && (
                    <button
                      type="button"
                      onClick={() => setPreviewCalcOpen((o) => !o)}
                      title={calcPanelOpen ? "Back to chat" : "Installment calculator"}
                      className={`${headerIconBtn} ${
                        calcPanelOpen ? "border-[#0057A8] bg-[#0057A8]/10 text-[#0057A8]" : ""
                      }`}
                    >
                      <Calculator className="h-[18px] w-[18px]" />
                    </button>
                  )}
                  <span className={headerIconBtn}>
                    <SquarePen className="h-[18px] w-[18px]" />
                  </span>
                  <span className={headerIconBtn}>
                    <LogOut className="h-[18px] w-[18px]" />
                  </span>
                  <span className="ml-0.5 flex items-center gap-0.5 border-l border-[#94a3b8] pl-1">
                    <span className={headerIconBtn}>
                      <Minus className="h-[18px] w-[18px]" />
                    </span>
                    <span className={headerIconBtn}>
                      <X className="h-[18px] w-[18px]" />
                    </span>
                  </span>
                </div>
              </header>

              {/* KB row */}
              {previewKbKeys.length > 0 && (
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">KB</span>
                  {previewKbKeys.map((key) => (
                    <span
                      key={key}
                      className="rounded-full border border-[#0057A8] bg-[#0057A8]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#0057A8]"
                    >
                      {kbLabel(key)}
                    </span>
                  ))}
                </div>
              )}

              {calcPanelOpen && activePreviewOption ? (
                /* calculator panel */
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="shrink-0 border-b border-[#94a3b8] px-3.5 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">Installment calculator</p>
                        <p className="text-[10px] text-slate-500">Approximate values for agents</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewCalcOpen(false)}
                        className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-[#0057A8] hover:text-[#0057A8]"
                      >
                        Back to chat
                      </button>
                    </div>
                    <div className="mt-2.5 flex gap-1">
                      {enabledTypes.map((key) => {
                        const active = activePreviewType === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setPreviewType(key)}
                            className={`flex-1 rounded-lg border px-2 py-2 text-center text-[11px] font-medium leading-tight ${
                              active
                                ? "border-[#0057A8] bg-[#0057A8]/10 text-[#003D75]"
                                : "border-slate-300 bg-white text-slate-600"
                            }`}
                          >
                            {productLabel(key)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-700">Principal (EGP)</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={previewPrincipal}
                        onChange={(e) => setPreviewPrincipal(e.target.value)}
                        placeholder="e.g. 10000"
                        className="w-full rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#0057A8]"
                      />
                    </label>
                    {principalValue == null && previewPrincipal.trim() !== "" && (
                      <p className="mt-2 text-xs text-rose-600">Enter a valid amount greater than zero.</p>
                    )}
                    {previewRows.length > 0 && (
                      <div className="mt-3 overflow-hidden rounded-xl border border-[#94a3b8]">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-[#94a3b8] bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                              <th className="px-2.5 py-2">Months</th>
                              <th className="px-2.5 py-2 text-right">Installment</th>
                              <th className="px-2.5 py-2 text-right">Interest</th>
                              <th className="px-2.5 py-2 text-right">Flat rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((row) => (
                              <tr
                                key={row.months}
                                className="border-b border-slate-100 last:border-b-0 odd:bg-white even:bg-slate-50/60"
                              >
                                <td className="px-2.5 py-2 font-medium text-slate-800">{row.months}</td>
                                <td className="px-2.5 py-2 text-right tabular-nums text-slate-900">
                                  {egp(row.installment)}
                                </td>
                                <td className="px-2.5 py-2 text-right tabular-nums text-slate-700">
                                  {egp(row.interest)}
                                </td>
                                <td className="px-2.5 py-2 text-right tabular-nums text-slate-600">
                                  {row.flatPct.toFixed(2)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
                      تقريبياً — share amounts as approximate with the customer.
                    </p>
                  </div>
                </div>
              ) : (
                /* chat empty state */
                <>
                  <div className="min-h-0 flex-1 overflow-y-auto bg-white px-3.5 py-3">
                    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border-2 border-[#94a3b8] bg-white p-1.5 shadow-sm">
                        <img src="/GoChat247_blue_transparent.png" alt="" className="h-full w-full object-contain" />
                      </div>
                      <p className="text-sm font-medium text-slate-800">How can I help?</p>
                      <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-slate-600">
                        Ask a question about your knowledge base or start a new topic.
                      </p>
                    </div>
                  </div>

                  {/* input */}
                  <div className="shrink-0 border-t border-[#94a3b8] bg-white px-3 pb-3 pt-2.5">
                    <div className="flex items-end gap-2 rounded-2xl border border-slate-400 bg-white p-1.5 shadow-sm">
                      <span className="flex-1 px-2.5 py-2 text-sm text-slate-400">Ask anything…</span>
                      <span className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#003D75] bg-[#0057A8] text-white">
                        <SendHorizontal className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="mt-1.5 text-center text-[10px] text-slate-500">
                      Enter to send · Shift+Enter for new line
                    </p>
                  </div>
                </>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Preview of the real widget. {form.calcEnabled ? "Click the calculator icon to preview it. " : ""}
              Changes apply after you save.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
