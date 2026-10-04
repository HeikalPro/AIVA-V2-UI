import { useMemo, useState } from "react";
import { Building2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ROLES } from "@/lib/roles";
import { formatUserError } from "@/lib/errors";
import { useAccountKbQueues, useUpdateAccount } from "@/hooks/useAccounts";
import { Page, PageHeading } from "@/components/shell/page";
import { EmptyState } from "@/components/data/empty-state";
import { Status } from "@/components/data/status";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorInput } from "@/components/ui/color-input";
import { Field, FieldGroup, FormSection } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { ToggleChip } from "@/components/widget-config/ToggleChip";
import { DEFAULT_WIDGET_ACCENT, WidgetPreview, type WidgetPreviewPanel } from "@/components/widget-config/WidgetPreview";
import {
  buildWidgetFeatures,
  EMPTY_LOCATION,
  formFromAccount,
  type LocationForm,
  type WidgetForm,
} from "@/components/widget-config/widget-form";
import {
  CALCULATOR_TENOR_OPTIONS,
  CALCULATOR_TYPE_OPTIONS,
  defaultCalculatorLabel,
  type CalculatorProductForm,
  type CalculatorTypeKey,
} from "@/lib/calculatorDefaults";
import type { Account, KbQueueGroup } from "@/types/api";

type ConfigTab = "appearance" | "knowledge" | "calculator" | "locations";

export function WidgetCustomizationPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN) ?? false;
  const workspace = useWorkspace();
  const account = workspace.account;
  const accountId = workspace.accountId;
  const updateAccount = useUpdateAccount();
  const kbQuery = useAccountKbQueues(accountId);
  const kbCatalog = useMemo(() => kbQuery.data ?? [], [kbQuery.data]);

  const [form, setForm] = useState<WidgetForm>(() => formFromAccount(account));
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ConfigTab>("appearance");
  const [panel, setPanel] = useState<WidgetPreviewPanel>("chat");

  // Reset the form whenever the account (or its saved data) changes — e.g. after a save the
  // accounts query refetches and the form reloads from the server.
  const [formSource, setFormSource] = useState<Account | null>(account);
  if (formSource !== account) {
    const switchedAccount = formSource?.id !== account?.id;
    setFormSource(account);
    setForm(formFromAccount(account));
    setError(null);
    if (switchedAccount) setPanel("chat");
  }

  const baseline = useMemo(() => formFromAccount(account), [account]);
  const dirty = useMemo(
    () => JSON.stringify(buildWidgetFeatures(form)) !== JSON.stringify(buildWidgetFeatures(baseline)),
    [form, baseline],
  );

  const patch = <K extends keyof WidgetForm>(key: K, value: WidgetForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  function setProduct(typeKey: CalculatorTypeKey, next: CalculatorProductForm) {
    setForm((f) => ({ ...f, calcProducts: { ...f.calcProducts, [typeKey]: next } }));
  }

  function setLocation(index: number, next: LocationForm) {
    setForm((f) => ({ ...f, locations: f.locations.map((l, i) => (i === index ? next : l)) }));
  }

  async function handleSave() {
    if (!account) return;
    setError(null);
    try {
      await updateAccount.mutateAsync({
        id: account.id,
        body: { widget_features: buildWidgetFeatures(form) },
      });
      toast.success(`Widget settings saved for ${account.name}`);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  function changeTab(next: string) {
    const value = next as ConfigTab;
    setTab(value);
    // Show the part of the widget being edited.
    if (value === "calculator") setPanel(form.calcEnabled ? "calculator" : "chat");
    else if (value === "locations") setPanel(form.locEnabled ? "locations" : "chat");
    else setPanel("chat");
  }

  const productLabel = (key: CalculatorTypeKey) => form.calcProducts[key]?.label.trim() || defaultCalculatorLabel(key);

  // KB buttons shown in the preview: the override list, else the whole catalog.
  const previewKbKeys = form.kbOverride ? form.kbVisibleKeys : kbCatalog.map((q) => q.key);
  const kbLabel = (key: string) => kbCatalog.find((q) => q.key === key)?.label ?? key;

  const heading = (
    <PageHeading
      title="Widget Configuration"
      description={
        account
          ? `Branding, knowledge buttons, installment calculator and branch locations of ${account.name}'s desktop widget.`
          : "Branding, knowledge buttons, installment calculator and branch locations of the desktop widget."
      }
    />
  );

  if (workspace.isLoading) {
    return (
      <Page width="default">
        {heading}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" aria-busy="true">
          <div className="space-y-5">
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-5 w-48" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          </div>
          <Skeleton className="h-[460px] w-full max-w-[360px] rounded-xl" />
        </div>
      </Page>
    );
  }

  if (account == null) {
    return (
      <Page width="default">
        {heading}
        <EmptyState
          icon={Building2}
          title="No account selected"
          description={
            isSuperAdmin
              ? "There are no accounts yet. Create one on the Accounts page to configure its widget."
              : "You don't have access to any account yet. Ask an administrator to add you to one."
          }
        />
      </Page>
    );
  }

  return (
    <Page width="default">
      {heading}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---------------- Configuration ---------------- */}
        <div className="min-w-0 space-y-5">
          <ErrorAlert message={error} />

          <Tabs value={tab} onValueChange={changeTab} className="gap-5">
            <TabsList aria-label="Widget settings">
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
              <TabsTrigger value="calculator">Calculator</TabsTrigger>
              <TabsTrigger value="locations">Locations</TabsTrigger>
            </TabsList>

            {/* Appearance */}
            <TabsContent value="appearance">
              <FormSection title="Branding" description="Header title, subtitle, brand colour and logo shown in this account's widget.">
                <FieldGroup columns={2}>
                  <Field label="Title" hint='Leave blank to show "GoChat247".'>
                    <Input
                      dir="auto"
                      value={form.brandTitle}
                      onChange={(e) => patch("brandTitle", e.target.value)}
                      placeholder="GoChat247"
                    />
                  </Field>
                  <Field label="Subtitle" hint='Shown after the account name. Blank shows "AI assistant".'>
                    <Input
                      dir="auto"
                      value={form.brandSubtitle}
                      onChange={(e) => patch("brandSubtitle", e.target.value)}
                      placeholder="AI assistant"
                    />
                  </Field>
                  <Field
                    label="Brand colour"
                    htmlFor="widget-accent"
                    hint={
                      form.brandAccent
                        ? "Accent for the header bar, KB buttons, active tabs and the send button."
                        : `Using the widget default (${DEFAULT_WIDGET_ACCENT.toUpperCase()}).`
                    }
                    labelAction={
                      form.brandAccent ? (
                        <Button variant="link" size="sm" className="h-5 px-0 text-xs" onClick={() => patch("brandAccent", "")}>
                          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                          Reset to default
                        </Button>
                      ) : undefined
                    }
                  >
                    <ColorInput
                      id="widget-accent"
                      value={form.brandAccent || DEFAULT_WIDGET_ACCENT}
                      onChange={(hex) => patch("brandAccent", hex)}
                    />
                  </Field>
                  <Field label="Logo URL" hint="Square PNG or SVG. Blank shows the GoChat247 logo.">
                    <Input
                      type="url"
                      value={form.brandLogoUrl}
                      onChange={(e) => patch("brandLogoUrl", e.target.value)}
                      placeholder="https://…/logo.png"
                    />
                  </Field>
                </FieldGroup>
              </FormSection>
            </TabsContent>

            {/* Knowledge */}
            <TabsContent value="knowledge">
              <FormSection title="Knowledge-base buttons" description="The KB buttons agents can toggle in this account's widget.">
                <Field
                  orientation="horizontal"
                  label="Restrict KB buttons"
                  htmlFor="widget-kb-override"
                  hint={
                    form.kbOverride
                      ? "Only the selected buttons are shown in the widget."
                      : `Off: the widget shows every button the account and agent allow${kbCatalog.length ? ` (${kbCatalog.length})` : ""}.`
                  }
                >
                  <Switch
                    id="widget-kb-override"
                    checked={form.kbOverride}
                    disabled={kbCatalog.length === 0}
                    onCheckedChange={(on) => {
                      // When first turning the override on, start with everything visible.
                      patch("kbOverride", on);
                      if (on && form.kbVisibleKeys.length === 0) {
                        patch(
                          "kbVisibleKeys",
                          kbCatalog.map((q) => q.key),
                        );
                      }
                    }}
                  />
                </Field>

                {kbQuery.isLoading ? (
                  <div className="flex flex-wrap gap-2" aria-busy="true">
                    {Array.from({ length: 3 }, (_, i) => (
                      <Skeleton key={i} className="h-7 w-20 rounded-full" />
                    ))}
                  </div>
                ) : kbCatalog.length === 0 ? (
                  <Alert
                    tone="neutral"
                    description="This account has no knowledge base configured, so there are no KB buttons to manage."
                  />
                ) : form.kbOverride ? (
                  <div className="space-y-2">
                    <Label id="widget-kb-buttons-label">Visible buttons</Label>
                    <div role="group" aria-labelledby="widget-kb-buttons-label" className="flex flex-wrap gap-2">
                      {kbCatalog.map((q: KbQueueGroup) => {
                        const checked = form.kbVisibleKeys.includes(q.key);
                        return (
                          <ToggleChip
                            key={q.key}
                            pressed={checked}
                            onPressedChange={() =>
                              patch(
                                "kbVisibleKeys",
                                checked ? form.kbVisibleKeys.filter((k) => k !== q.key) : [...form.kbVisibleKeys, q.key],
                              )
                            }
                          >
                            {q.label}
                          </ToggleChip>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {form.kbOverride && form.kbVisibleKeys.length === 0 && kbCatalog.length > 0 && (
                  <Alert tone="warning" description="No buttons selected: the widget will show no KB buttons for this account." />
                )}
              </FormSection>
            </TabsContent>

            {/* Calculator */}
            <TabsContent value="calculator">
              <FormSection title="Installment calculator" description="A loan / installment calculator button in the widget header.">
                <Field
                  orientation="horizontal"
                  label="Show the calculator"
                  htmlFor="widget-calc-enabled"
                  hint="Agents open it from the calculator icon in the widget."
                >
                  <Switch
                    id="widget-calc-enabled"
                    checked={form.calcEnabled}
                    onCheckedChange={(on) => {
                      patch("calcEnabled", on);
                      if (tab === "calculator") setPanel(on ? "calculator" : "chat");
                    }}
                  />
                </Field>

                {form.calcEnabled && (
                  <div className="space-y-3">
                    {CALCULATOR_TYPE_OPTIONS.map((opt) => {
                      const typeKey = opt.key as CalculatorTypeKey;
                      const on = form.calcTypes.includes(typeKey);
                      const onlyOne = on && form.calcTypes.length === 1;
                      const product = form.calcProducts[typeKey];
                      const checkboxId = `widget-calc-type-${typeKey}`;
                      return (
                        <Card key={opt.key} className="p-4">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Checkbox
                              id={checkboxId}
                              checked={on}
                              disabled={onlyOne}
                              onCheckedChange={() => {
                                const next = on ? form.calcTypes.filter((t) => t !== typeKey) : [...form.calcTypes, typeKey];
                                if (next.length === 0) return; // keep at least one product
                                patch("calcTypes", next);
                              }}
                            />
                            <Label htmlFor={checkboxId} className="cursor-pointer text-sm">
                              <span dir="auto">{productLabel(typeKey)}</span>
                            </Label>
                            {productLabel(typeKey) !== opt.label && (
                              <span className="text-xs text-muted-foreground">({opt.label})</span>
                            )}
                            <span className="ml-auto text-xs text-muted-foreground">
                              {onlyOne ? "At least one product stays on" : opt.usesApr ? "APR product" : "Flat-rate product"}
                            </span>
                          </div>

                          {on && (
                            <div className="mt-4 space-y-4 border-t border-border pt-4">
                              <FieldGroup columns={2}>
                                <Field
                                  label="Display name"
                                  hint={`Tab name in the widget. Blank uses "${defaultCalculatorLabel(typeKey)}".`}
                                >
                                  <Input
                                    dir="auto"
                                    value={product.label}
                                    onChange={(e) => setProduct(typeKey, { ...product, label: e.target.value })}
                                    placeholder={defaultCalculatorLabel(typeKey)}
                                  />
                                </Field>
                                {opt.usesApr && (
                                  <Field label="APR (%)" hint="Annual rate, declining balance.">
                                    <Input
                                      inputMode="decimal"
                                      value={product.aprPercent}
                                      onChange={(e) => setProduct(typeKey, { ...product, aprPercent: e.target.value })}
                                      placeholder="55"
                                    />
                                  </Field>
                                )}
                              </FieldGroup>

                              <div className="space-y-2">
                                <Label id={`${checkboxId}-tenors`}>Tenors (months)</Label>
                                <div role="group" aria-labelledby={`${checkboxId}-tenors`} className="flex flex-wrap gap-1.5">
                                  {CALCULATOR_TENOR_OPTIONS.map((month) => {
                                    const tenorOn = product.tenors.includes(month);
                                    return (
                                      <ToggleChip
                                        key={month}
                                        pressed={tenorOn}
                                        aria-label={`${month} months`}
                                        onPressedChange={() => {
                                          const nextTenors = tenorOn
                                            ? product.tenors.filter((t) => t !== month)
                                            : [...product.tenors, month];
                                          if (nextTenors.length === 0) return;
                                          setProduct(typeKey, { ...product, tenors: nextTenors });
                                        }}
                                      >
                                        {month}
                                      </ToggleChip>
                                    );
                                  })}
                                </div>
                                <p className="text-xs text-muted-foreground">At least one tenor is required.</p>
                              </div>

                              {!opt.usesApr && (
                                <div className="space-y-2">
                                  <p className="text-ui font-medium text-foreground">Flat rate per month (%)</p>
                                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    {product.tenors.map((month) => (
                                      <Field key={month} label={`${month} months`}>
                                        <Input
                                          inputMode="decimal"
                                          controlSize="sm"
                                          value={product.flatRatePercents[String(month)] ?? ""}
                                          onChange={(e) =>
                                            setProduct(typeKey, {
                                              ...product,
                                              flatRatePercents: { ...product.flatRatePercents, [String(month)]: e.target.value },
                                            })
                                          }
                                        />
                                      </Field>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </FormSection>
            </TabsContent>

            {/* Locations */}
            <TabsContent value="locations">
              <FormSection title="Locations" description="A branches button in the widget listing this account's addresses.">
                <Field
                  orientation="horizontal"
                  label="Show locations"
                  htmlFor="widget-loc-enabled"
                  hint="Agents open the list from the map-pin icon in the widget."
                >
                  <Switch
                    id="widget-loc-enabled"
                    checked={form.locEnabled}
                    onCheckedChange={(on) => {
                      patch("locEnabled", on);
                      if (tab === "locations") setPanel(on ? "locations" : "chat");
                    }}
                  />
                </Field>

                {form.locEnabled && (
                  <div className="space-y-3">
                    {form.locations.length === 0 && (
                      <p className="text-sm text-muted-foreground">No locations yet. Add the first branch below.</p>
                    )}
                    {form.locations.map((loc, i) => (
                      <Card key={i} className="p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <p className="text-ui font-semibold text-foreground">
                            Location {i + 1}
                            {loc.name.trim() && (
                              <span className="font-normal text-muted-foreground">
                                {" "}
                                · <bdi>{loc.name.trim()}</bdi>
                              </span>
                            )}
                          </p>
                          <IconButton
                            label={`Remove location ${i + 1}`}
                            icon={Trash2}
                            size="sm"
                            className="hover:text-danger"
                            onClick={() =>
                              patch(
                                "locations",
                                form.locations.filter((_, idx) => idx !== i),
                              )
                            }
                          />
                        </div>
                        <FieldGroup columns={2}>
                          <Field label="Name" required>
                            <Input
                              dir="auto"
                              value={loc.name}
                              onChange={(e) => setLocation(i, { ...loc, name: e.target.value })}
                              placeholder="Main branch"
                            />
                          </Field>
                          <Field label="Area / district">
                            <Input
                              dir="auto"
                              value={loc.area}
                              onChange={(e) => setLocation(i, { ...loc, area: e.target.value })}
                              placeholder="Maadi"
                            />
                          </Field>
                          <Field label="Address" className="sm:col-span-2">
                            <Input
                              dir="auto"
                              value={loc.address}
                              onChange={(e) => setLocation(i, { ...loc, address: e.target.value })}
                              placeholder="Street, building, nearby landmark…"
                            />
                          </Field>
                          <Field label="Phone / hotline">
                            <Input
                              dir="auto"
                              value={loc.phone}
                              onChange={(e) => setLocation(i, { ...loc, phone: e.target.value })}
                              placeholder="16134"
                            />
                          </Field>
                          <Field label="Working hours">
                            <Input
                              dir="auto"
                              value={loc.hours}
                              onChange={(e) => setLocation(i, { ...loc, hours: e.target.value })}
                              placeholder="Sat–Thu 9am–5pm"
                            />
                          </Field>
                          <Field label="Google Maps URL" className="sm:col-span-2">
                            <Input
                              type="url"
                              value={loc.mapsUrl}
                              onChange={(e) => setLocation(i, { ...loc, mapsUrl: e.target.value })}
                              placeholder="https://maps.google.com/…"
                            />
                          </Field>
                        </FieldGroup>
                      </Card>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => patch("locations", [...form.locations, { ...EMPTY_LOCATION }])}
                    >
                      <Plus aria-hidden="true" className="h-4 w-4" />
                      Add location
                    </Button>
                    {form.locations.length > 0 && form.locations.every((l) => !l.name.trim()) && (
                      <Alert tone="warning" description="Locations need at least a name to be saved and shown." />
                    )}
                  </div>
                )}
              </FormSection>
            </TabsContent>
          </Tabs>

          {/* Save bar: stays at the bottom of the scroll area while the form is longer than the screen. */}
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-md">
            <div aria-live="polite" className="min-w-0">
              {dirty ? (
                <Status tone="warning" label="Unsaved changes" />
              ) : (
                <span className="text-ui text-muted-foreground">No unsaved changes</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {dirty && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setForm(baseline);
                    setError(null);
                  }}
                  disabled={updateAccount.isPending}
                >
                  Discard
                </Button>
              )}
              <Button onClick={handleSave} loading={updateAccount.isPending}>
                {updateAccount.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>

        {/* ---------------- Live preview (mirrors the real widget) ---------------- */}
        <aside aria-labelledby="widget-preview-heading" className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 id="widget-preview-heading" className="text-sm font-semibold text-foreground">
              Live preview
            </h2>
            <span className="text-xs text-muted-foreground">Desktop widget</span>
          </div>
          <WidgetPreview
            key={account.id}
            className="mx-auto"
            accountName={account.name}
            title={form.brandTitle}
            subtitle={form.brandSubtitle}
            accentColor={form.brandAccent}
            logoUrl={form.brandLogoUrl}
            kbButtons={previewKbKeys.map((key) => ({ key, label: kbLabel(key) }))}
            calculator={{ enabled: form.calcEnabled, types: form.calcTypes, products: form.calcProducts }}
            locations={{ enabled: form.locEnabled, items: form.locations }}
            panel={panel}
            onPanelChange={setPanel}
          />
          <p className="mx-auto mt-2 max-w-[360px] text-xs text-muted-foreground">
            Shows unsaved changes. Use the header buttons to open the calculator or locations. Agents see changes after you save.
          </p>
        </aside>
      </div>
    </Page>
  );
}
