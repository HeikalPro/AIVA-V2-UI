import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Cpu, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { formatUserError } from "@/lib/errors";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  useLLMConfigs,
  useModelCatalog,
  useRefreshModelCatalog,
  useCreateLLMConfig,
  useUpdateLLMConfig,
  useDeleteLLMConfig,
} from "@/hooks/useLLMConfigs";
import { Page, PageHeading } from "@/components/shell/page";
import { DataTable, actionsColumn, type Column } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Status, type StatusTone } from "@/components/data/status";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FormSection } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { RelativeTime } from "@/components/doc-intel/RelativeTime";
import type { LLMConfig, ModelCatalogItem } from "@/types/api";

/** All chat traffic goes through the SovereignEG gateway; prefill it on new configs
 *  so a blank base URL never silently falls back to official OpenAI.
 *  Mirrors _DEFAULT_BASE in backend/services/sovereign_catalog.py. */
const DEFAULT_API_BASE_URL = "https://backend.sovereigneg.com/v1";

/** Catalog prices are EGP per 1M tokens (input_per_1m_egp / output_per_1m_egp). */
function egp(n?: number | null): string {
  return formatMoney(n, "EGP");
}

/** "EGP 25.00 / EGP 75.00" (input / output per 1M tokens), or just input for embedding models. */
function modelPriceLabel(item?: ModelCatalogItem): string {
  if (!item) return "—";
  const inp = egp(item.input_per_1m_egp);
  if (item.output_per_1m_egp == null) return inp;
  return `${inp} / ${egp(item.output_per_1m_egp)}`;
}

const CATALOG_STATUS: Record<"ok" | "stale" | "error", { tone: StatusTone; label: string }> = {
  ok: { tone: "success", label: "Prices up to date" },
  stale: { tone: "warning", label: "Showing last known prices" },
  error: { tone: "danger", label: "Prices not loaded" },
};

export function LLMConfigsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data = [], isLoading, isError, error: loadError, refetch } = useLLMConfigs();
  const { data: catalogData, isLoading: catalogLoading } = useModelCatalog();
  const refreshCatalog = useRefreshModelCatalog();
  const catalog = useMemo(() => catalogData?.items ?? [], [catalogData]);
  const catalogError = refreshCatalog.data?.error ?? catalogData?.error ?? null;
  const catalogStale = refreshCatalog.data?.stale ?? catalogData?.stale ?? false;
  const catalogLastSuccess = refreshCatalog.data?.last_success_at ?? catalogData?.last_success_at ?? null;
  const catalogState: "ok" | "stale" | "error" = catalogError && catalog.length === 0 ? "error" : catalogStale ? "stale" : "ok";
  const priceByModel = useMemo(() => {
    const m = new Map<string, ModelCatalogItem>();
    for (const item of catalog) m.set(item.id.toLowerCase(), item);
    return m;
  }, [catalog]);
  const createConfig = useCreateLLMConfig();
  const updateConfig = useUpdateLLMConfig();
  const deleteConfig = useDeleteLLMConfig();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LLMConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LLMConfig | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [form, setForm] = useState({
    provider: "openai",
    model_name: "",
    comment: "",
    api_base_url: "",
    temperature: "0.7",
    max_tokens: "4096",
    embedding_model: "",
    reranker_model: "",
    is_active: true,
  });
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm({
      provider: "OpenAI",
      model_name: "",
      comment: "",
      api_base_url: DEFAULT_API_BASE_URL,
      temperature: "0.7",
      max_tokens: "4096",
      embedding_model: "",
      reranker_model: "",
      is_active: true,
    });
    setError(null);
    setDialogOpen(true);
  }

  // ?action=create (command palette): open the create dialog, then drop the param.
  useEffect(() => {
    if (searchParams.get("action") !== "create") return;
    openCreate();
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("action");
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  function openEdit(c: LLMConfig) {
    setEditing(c);
    setForm({
      provider: c.provider,
      model_name: c.model_name,
      comment: c.comment ?? "",
      api_base_url: c.api_base_url ?? "",
      temperature: c.temperature != null ? String(c.temperature) : "",
      max_tokens: c.max_tokens != null ? String(c.max_tokens) : "",
      embedding_model: c.embedding_model ?? "",
      reranker_model: c.reranker_model ?? "",
      is_active: c.is_active,
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setError(null);
    const body = {
      provider: form.provider,
      model_name: form.model_name,
      comment: form.comment || null,
      api_base_url: form.api_base_url || null,
      temperature: form.temperature ? Number(form.temperature) : null,
      max_tokens: form.max_tokens ? Number(form.max_tokens) : null,
      embedding_model: form.embedding_model || null,
      reranker_model: form.reranker_model || null,
      is_active: form.is_active,
    };
    try {
      if (editing) await updateConfig.mutateAsync({ id: editing.id, body });
      else await createConfig.mutateAsync(body);
      toast.success(editing ? "LLM config saved" : "LLM config created", { description: form.model_name });
      setDialogOpen(false);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteConfig.mutateAsync(deleteTarget.id);
      toast.success("LLM config deleted", { description: deleteTarget.model_name });
      setDeleteTarget(null);
      setDeleteError(null);
    } catch (e) {
      setDeleteError(formatUserError(e));
    }
  }

  function refreshPrices() {
    refreshCatalog.mutate(undefined, {
      onSuccess: (out) => {
        if (out?.error) toast.warning("Couldn't refresh prices", { description: out.error });
        else toast.success("Prices refreshed", { description: `${formatNumber(out?.items?.length ?? 0)} models` });
      },
      onError: (e) => toast.error("Couldn't refresh prices", { description: formatUserError(e) }),
    });
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((c) => [c.provider, c.model_name, c.comment ?? "", c.api_base_url ?? ""].join(" ").toLowerCase().includes(q));
  }, [data, search]);

  const columns: Column<LLMConfig>[] = [
    { key: "provider", header: "Provider", sortable: true },
    {
      key: "model_name",
      header: "Model",
      sortable: true,
      render: (r) => (
        <div className="min-w-0 max-w-[22rem]">
          <p className="truncate font-mono text-xs text-foreground" title={r.model_name}>
            {r.model_name}
          </p>
          {r.comment && (
            <p className="truncate text-xs text-muted-foreground" title={r.comment}>
              <bdi>{r.comment}</bdi>
            </p>
          )}
        </div>
      ),
    },
    {
      key: "input_price",
      header: "Input / 1M tokens",
      numeric: true,
      sortable: true,
      sortValue: (r) => priceByModel.get(r.model_name.toLowerCase())?.input_per_1m_egp ?? null,
      render: (r) => {
        const item = priceByModel.get(r.model_name.toLowerCase());
        return item ? egp(item.input_per_1m_egp) : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      key: "output_price",
      header: "Output / 1M tokens",
      numeric: true,
      sortable: true,
      sortValue: (r) => priceByModel.get(r.model_name.toLowerCase())?.output_per_1m_egp ?? null,
      render: (r) => {
        const item = priceByModel.get(r.model_name.toLowerCase());
        return item && item.output_per_1m_egp != null ? egp(item.output_per_1m_egp) : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      key: "temperature",
      header: "Temperature",
      numeric: true,
      sortable: true,
      render: (r) => (r.temperature != null ? r.temperature : "—"),
    },
    {
      key: "max_tokens",
      header: "Max tokens",
      numeric: true,
      sortable: true,
      defaultHidden: true,
      render: (r) => formatNumber(r.max_tokens),
    },
    {
      key: "api_base_url",
      header: "Endpoint",
      truncate: true,
      maxWidth: "16rem",
      defaultHidden: true,
      render: (r) => <span className="font-mono text-xs">{r.api_base_url ?? "—"}</span>,
      cellTitle: (r) => r.api_base_url ?? undefined,
    },
    {
      key: "is_active",
      header: "Status",
      sortable: true,
      sortValue: (r) => (r.is_active ? 0 : 1),
      render: (r) => <Status tone={r.is_active ? "success" : "neutral"} label={r.is_active ? "Active" : "Inactive"} />,
    },
    { key: "id", header: "ID", sortable: true, defaultHidden: true, render: (r) => <span className="font-mono text-xs">#{r.id}</span> },
    actionsColumn<LLMConfig>(
      (r) => [
        { label: "Edit", icon: Pencil, onSelect: () => openEdit(r) },
        {
          label: "Delete",
          icon: Trash2,
          destructive: true,
          separatorBefore: true,
          onSelect: () => {
            setDeleteError(null);
            setDeleteTarget(r);
          },
        },
      ],
      { label: (r) => `Actions for ${r.model_name}` },
    ),
  ];

  const modelQuery = form.model_name.trim().toLowerCase();
  const modelPrice = modelQuery ? priceByModel.get(modelQuery) : undefined;
  const statusMeta = CATALOG_STATUS[catalogState];

  return (
    <Page width="default">
      <PageHeading
        title="LLM Configs"
        description="Model, endpoint and generation settings used by accounts. Prices come from the SovereignEG catalog."
        actions={
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            New config
          </Button>
        }
      />

      <section aria-label="SovereignEG price catalog" className="space-y-3 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-ui font-semibold text-foreground">SovereignEG prices</span>
            {catalogLoading ? (
              <Skeleton className="h-4 w-36" />
            ) : (
              <Status tone={statusMeta.tone} label={statusMeta.label} />
            )}
            <span className="text-xs text-muted-foreground">
              {catalogState === "error" ? (
                "Not loaded"
              ) : (
                <>
                  {formatNumber(catalog.length)} models ·{" "}
                  {catalogLastSuccess ? (
                    <>
                      updated <RelativeTime value={catalogLastSuccess} />
                    </>
                  ) : (
                    "loaded this session"
                  )}
                </>
              )}
              {" · auto-refresh daily 10:00 PM Cairo"}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={refreshPrices} disabled={refreshCatalog.isPending}>
            <RefreshCw aria-hidden="true" className={refreshCatalog.isPending ? "h-4 w-4 motion-safe:animate-spin" : "h-4 w-4"} />
            Refresh prices
          </Button>
        </div>
        {(catalogError || catalogStale) && (
          <Alert
            tone={catalogState === "error" ? "danger" : "warning"}
            title={catalogStale ? "Couldn't refresh: showing the last known prices." : "Couldn't load SovereignEG prices."}
          >
            {catalogError && <span className="block break-words font-mono text-xs">{catalogError}</span>}
            {refreshCatalog.isError && <span className="block text-xs text-muted-foreground">Retry request failed: check your connection.</span>}
          </Alert>
        )}
      </section>

      <DataTable<LLMConfig>
        aria-label="LLM configs"
        columns={columns}
        data={isError ? [] : rows}
        keyFn={(r) => r.id}
        loading={isLoading}
        itemLabel="configs"
        onRowClick={openEdit}
        enableColumnVisibility
        persistKey="llm-configs"
        empty={
          isError
            ? {
                title: "Couldn't load LLM configs",
                description: formatUserError(loadError),
                action: (
                  <Button variant="outline" size="sm" onClick={() => void refetch()}>
                    Try again
                  </Button>
                ),
              }
            : search.trim()
              ? {
                  title: "No configs match your search",
                  action: (
                    <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                      Clear search
                    </Button>
                  ),
                }
              : { icon: Cpu, title: "No LLM configs yet", description: "Create one to choose the model accounts use." }
        }
        toolbar={
          <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search provider, model, comment…" onClear={() => setSearch("")} />
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} size="lg">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit LLM config" : "New LLM config"}</DialogTitle>
            <DialogDescription>
              {editing ? (
                <>
                  <span className="font-mono">{editing.model_name}</span> · config <span className="font-mono">#{editing.id}</span>
                </>
              ) : (
                "Requests go through the SovereignEG gateway unless you change the endpoint."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-6">
            <FormSection title="Model">
              <FieldGroup columns={2}>
                <Field label="Provider" htmlFor="llm-provider">
                  <Input id="llm-provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
                </Field>
                <Field
                  label="Model name"
                  htmlFor="llm-model"
                  hint={
                    !modelQuery ? (
                      "Pick from the SovereignEG catalog or type an ID."
                    ) : modelPrice ? (
                      <>
                        SovereignEG price: <span className="font-medium text-foreground">{modelPriceLabel(modelPrice)}</span> per 1M tokens (in /
                        out){modelPrice.status ? ` · ${modelPrice.status}` : ""}
                      </>
                    ) : (
                      <span className="text-warning">Not in the SovereignEG catalog: double-check the model ID or requests will fail.</span>
                    )
                  }
                >
                  <Input
                    id="llm-model"
                    value={form.model_name}
                    onChange={(e) => setForm({ ...form, model_name: e.target.value })}
                    list="sovereign-model-ids"
                    placeholder="e.g. deepseek-v4-flash"
                    className="font-mono text-ui"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>
              </FieldGroup>
              <datalist id="sovereign-model-ids">
                {catalog.map((m) => (
                  <option key={m.id} value={m.id}>
                    {modelPriceLabel(m)} per 1M
                  </option>
                ))}
              </datalist>
              <Field label="Comment" htmlFor="llm-comment">
                <Input
                  id="llm-comment"
                  dir="auto"
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  placeholder="Short note about this model"
                />
              </Field>
              <Field orientation="horizontal" label="Active" htmlFor="llm-active" hint="Inactive configs can't be chosen for new answers.">
                <Switch id="llm-active" checked={form.is_active} onCheckedChange={(on) => setForm({ ...form, is_active: on })} />
              </Field>
            </FormSection>

            <FormSection title="Endpoint">
              <Field label="API base URL" htmlFor="llm-base-url" hint={`Default: ${DEFAULT_API_BASE_URL}`}>
                <Input
                  id="llm-base-url"
                  type="url"
                  value={form.api_base_url}
                  onChange={(e) => setForm({ ...form, api_base_url: e.target.value })}
                  className="font-mono text-ui"
                  spellCheck={false}
                />
              </Field>
            </FormSection>

            <FormSection title="Generation">
              <FieldGroup columns={2}>
                <Field label="Temperature" htmlFor="llm-temperature" hint="0 = deterministic, higher = more varied.">
                  <Input
                    id="llm-temperature"
                    inputMode="decimal"
                    value={form.temperature}
                    onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                  />
                </Field>
                <Field label="Max tokens" htmlFor="llm-max-tokens" hint="Upper bound for each answer.">
                  <Input
                    id="llm-max-tokens"
                    inputMode="numeric"
                    value={form.max_tokens}
                    onChange={(e) => setForm({ ...form, max_tokens: e.target.value })}
                  />
                </Field>
              </FieldGroup>
            </FormSection>

            <FormSection title="Retrieval">
              <FieldGroup columns={2}>
                <Field label="Embedding model" htmlFor="llm-embedding">
                  <Input
                    id="llm-embedding"
                    value={form.embedding_model}
                    onChange={(e) => setForm({ ...form, embedding_model: e.target.value })}
                    className="font-mono text-ui"
                    spellCheck={false}
                  />
                </Field>
                <Field label="Reranker model" htmlFor="llm-reranker">
                  <Input
                    id="llm-reranker"
                    value={form.reranker_model}
                    onChange={(e) => setForm({ ...form, reranker_model: e.target.value })}
                    className="font-mono text-ui"
                    spellCheck={false}
                  />
                </Field>
              </FieldGroup>
            </FormSection>

            <ErrorAlert message={error} />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={createConfig.isPending || updateConfig.isPending}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete LLM config?"
        message={`${deleteTarget ? `“${deleteTarget.model_name}” will be deleted. ` : ""}This action cannot be undone. Accounts using this config will fall back to the default LLM settings.`}
        confirmLabel="Delete"
        loadingLabel="Deleting…"
        error={deleteError}
        destructive
        loading={deleteConfig.isPending}
        onCancel={() => {
          if (deleteConfig.isPending) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={confirmDelete}
      />
    </Page>
  );
}
