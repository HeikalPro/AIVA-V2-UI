import { useMemo, useState } from "react";
import { AlertTriangle, Cpu, Plus, RefreshCw, Trash2 } from "lucide-react";
import { formatUserError } from "@/lib/errors";
import { useLLMConfigs, useModelCatalog, useRefreshModelCatalog, useCreateLLMConfig, useUpdateLLMConfig, useDeleteLLMConfig } from "@/hooks/useLLMConfigs";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { LLMConfig, ModelCatalogItem } from "@/types/api";

function fmtEgp(n?: number | null): string {
  if (n == null) return "—";
  return `E£${n.toLocaleString("en", { maximumFractionDigits: 2 })}`;
}

/** "E£25 / E£75" (input / output per 1M tokens), or just input for embed models. */
function modelPriceLabel(item?: ModelCatalogItem): string {
  if (!item) return "—";
  const inp = fmtEgp(item.input_per_1m_egp);
  if (item.output_per_1m_egp == null) return inp;
  return `${inp} / ${fmtEgp(item.output_per_1m_egp)}`;
}

export function LLMConfigsPage() {
  const { data = [], isLoading } = useLLMConfigs();
  const { data: catalogData } = useModelCatalog();
  const refreshCatalog = useRefreshModelCatalog();
  const catalog = catalogData?.items ?? [];
  const catalogError = refreshCatalog.data?.error ?? catalogData?.error ?? null;
  const catalogStale = refreshCatalog.data?.stale ?? catalogData?.stale ?? false;
  const catalogLastSuccess = refreshCatalog.data?.last_success_at ?? catalogData?.last_success_at ?? null;
  const catalogState: "ok" | "stale" | "error" =
    catalogError && catalog.length === 0 ? "error" : catalogStale ? "stale" : "ok";
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
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
    setForm({ provider: "openai", model_name: "", comment: "", api_base_url: "", temperature: "0.7", max_tokens: "4096", embedding_model: "", reranker_model: "", is_active: true });
    setError(null);
    setDialogOpen(true);
  }

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
      setDialogOpen(false);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Cpu}
        title="LLM Configs"
        description="Manage LLM provider configurations"
        actions={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New Config</Button>}
      />

      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${catalogState === "error" ? "bg-red-500" : catalogState === "stale" ? "bg-amber-500" : "bg-emerald-500"}`} />
            <div>
              <p className="text-sm font-semibold text-foreground">SovereignEG prices</p>
              <p className="text-xs text-muted-foreground">
                {catalogState === "error"
                  ? "Not loaded"
                  : `${catalog.length} models · ${catalogLastSuccess ? `updated ${new Date(catalogLastSuccess).toLocaleString()}` : "loaded this session"}`}
                {" · auto-refresh daily 10:00 PM Cairo"}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refreshCatalog.mutate()} disabled={refreshCatalog.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshCatalog.isPending ? "animate-spin" : ""}`} /> Refresh prices
          </Button>
        </div>
        {(catalogError || catalogStale) && (
          <div className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${catalogState === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-medium">
                {catalogStale ? "Couldn't refresh — showing the last known prices." : "Couldn't load SovereignEG prices."}
              </p>
              {catalogError && <p className="break-words font-mono opacity-90">{catalogError}</p>}
              {refreshCatalog.isError && <p className="opacity-75">Retry request failed — check your connection.</p>}
            </div>
          </div>
        )}
      </div>

      <DataTable<LLMConfig>
        columns={[
          { key: "id", header: "ID", sortable: true },
          { key: "provider", header: "Provider", sortable: true },
          { key: "model_name", header: "Model", sortable: true },
          {
            key: "price",
            header: "Price (EGP / 1M · in/out)",
            render: (r) => {
              const item = priceByModel.get(r.model_name.toLowerCase());
              if (!item) return <span className="text-muted-foreground">—</span>;
              return <span className="whitespace-nowrap tabular-nums">{modelPriceLabel(item)}</span>;
            },
          },
          { key: "comment", header: "Comment", sortable: true, render: (r) => r.comment ?? "—" },
          { key: "temperature", header: "Temp", render: (r) => r.temperature ?? "—" },
          { key: "is_active", header: "Active", render: (r) => r.is_active ? <Badge variant="success">Yes</Badge> : <Badge variant="muted">No</Badge> },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleteId(r.id); }}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ),
          },
        ]}
        data={data}
        keyFn={(r) => r.id}
        loading={isLoading}
        onRowClick={openEdit}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit LLM Config" : "New LLM Config"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Provider</Label><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="mt-1" /></div>
            <div>
              <Label>Model Name</Label>
              <Input
                value={form.model_name}
                onChange={(e) => setForm({ ...form, model_name: e.target.value })}
                list="sovereign-model-ids"
                placeholder="e.g. deepseek-v4-flash"
                className="mt-1"
              />
              <datalist id="sovereign-model-ids">
                {catalog.map((m) => (
                  <option key={m.id} value={m.id}>{modelPriceLabel(m)} EGP/1M</option>
                ))}
              </datalist>
              {(() => {
                const q = form.model_name.trim().toLowerCase();
                if (!q) return null;
                const item = priceByModel.get(q);
                return item ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    SovereignEG price: <span className="font-medium text-foreground">{modelPriceLabel(item)}</span> per 1M tokens (in / out)
                    {item.status ? ` · ${item.status}` : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-amber-600">Not in the SovereignEG catalog — double-check the model id or requests will fail.</p>
                );
              })()}
            </div>
            <div><Label>Comment</Label><Input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="Short note about this model" className="mt-1" /></div>
            <div><Label>API Base URL</Label><Input value={form.api_base_url} onChange={(e) => setForm({ ...form, api_base_url: e.target.value })} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Temperature</Label><Input value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} className="mt-1" /></div>
              <div><Label>Max Tokens</Label><Input value={form.max_tokens} onChange={(e) => setForm({ ...form, max_tokens: e.target.value })} className="mt-1" /></div>
            </div>
            <div><Label>Embedding Model</Label><Input value={form.embedding_model} onChange={(e) => setForm({ ...form, embedding_model: e.target.value })} className="mt-1" /></div>
            <div><Label>Reranker Model</Label><Input value={form.reranker_model} onChange={(e) => setForm({ ...form, reranker_model: e.target.value })} className="mt-1" /></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Active
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId != null}
        title="Delete LLM config"
        message="This action cannot be undone. Accounts using this config will fall back to the default LLM settings."
        error={deleteError}
        destructive
        loading={deleteConfig.isPending}
        onCancel={() => { setDeleteId(null); setDeleteError(null); }}
        onConfirm={async () => {
          if (!deleteId) return;
          setDeleteError(null);
          try {
            await deleteConfig.mutateAsync(deleteId);
            setDeleteId(null);
            setDeleteError(null);
          } catch (e) {
            setDeleteError(formatUserError(e));
          }
        }}
      />
    </div>
  );
}
