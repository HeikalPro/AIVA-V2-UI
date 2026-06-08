import { useState } from "react";
import { Cpu, Plus, Trash2 } from "lucide-react";
import { formatUserError } from "@/lib/errors";
import { useLLMConfigs, useCreateLLMConfig, useUpdateLLMConfig, useDeleteLLMConfig } from "@/hooks/useLLMConfigs";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { LLMConfig } from "@/types/api";

export function LLMConfigsPage() {
  const { data = [], isLoading } = useLLMConfigs();
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
    setForm({ provider: "openai", model_name: "", api_base_url: "", temperature: "0.7", max_tokens: "4096", embedding_model: "", reranker_model: "", is_active: true });
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(c: LLMConfig) {
    setEditing(c);
    setForm({
      provider: c.provider,
      model_name: c.model_name,
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

      <DataTable<LLMConfig>
        columns={[
          { key: "id", header: "ID", sortable: true },
          { key: "provider", header: "Provider", sortable: true },
          { key: "model_name", header: "Model", sortable: true },
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
            <div><Label>Model Name</Label><Input value={form.model_name} onChange={(e) => setForm({ ...form, model_name: e.target.value })} className="mt-1" /></div>
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
          // #region agent log
          fetch('http://127.0.0.1:7810/ingest/b11a0305-32bc-48ad-ac2b-3f39b7a5fc7f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'086c7b'},body:JSON.stringify({sessionId:'086c7b',location:'LLMConfigsPage.tsx:onConfirm:start',message:'delete confirm clicked',data:{deleteId},timestamp:Date.now(),hypothesisId:'H3',runId:'post-fix'})}).catch(()=>{});
          // #endregion
          if (!deleteId) return;
          setDeleteError(null);
          try {
            await deleteConfig.mutateAsync(deleteId);
            // #region agent log
            fetch('http://127.0.0.1:7810/ingest/b11a0305-32bc-48ad-ac2b-3f39b7a5fc7f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'086c7b'},body:JSON.stringify({sessionId:'086c7b',location:'LLMConfigsPage.tsx:onConfirm:success',message:'delete mutation succeeded',data:{deleteId},timestamp:Date.now(),hypothesisId:'H5',runId:'post-fix'})}).catch(()=>{});
            // #endregion
            setDeleteId(null);
            setDeleteError(null);
          } catch (e) {
            setDeleteError(formatUserError(e));
            // #region agent log
            fetch('http://127.0.0.1:7810/ingest/b11a0305-32bc-48ad-ac2b-3f39b7a5fc7f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'086c7b'},body:JSON.stringify({sessionId:'086c7b',location:'LLMConfigsPage.tsx:onConfirm:error',message:'delete mutation failed',data:{deleteId,error:String(e),name:(e as Error)?.name,status:(e as {status?:number})?.status},timestamp:Date.now(),hypothesisId:'H2',runId:'post-fix'})}).catch(()=>{});
            // #endregion
          }
        }}
      />
    </div>
  );
}
