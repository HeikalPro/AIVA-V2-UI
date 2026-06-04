import { useEffect, useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserError } from "@/lib/errors";
import { ROLES } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import {
  usePrompts,
  useCreatePrompt,
  useUpdatePrompt,
  useDeletePrompt,
  useSystemPrompt,
  useUpdateSystemPrompt,
} from "@/hooks/usePrompts";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Prompt } from "@/types/api";

export function PromptsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const { data: accounts = [] } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const [accountId, setAccountId] = useState<number | null>(null);
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;
  const { data = [], isLoading } = usePrompts(selectedAccountId);
  const { data: systemPrompt, isLoading: systemPromptLoading } = useSystemPrompt();
  const createPrompt = useCreatePrompt();
  const updatePrompt = useUpdatePrompt();
  const deletePrompt = useDeletePrompt();
  const updateSystemPrompt = useUpdateSystemPrompt();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ prompt_name: "", prompt_type: "", prompt_text: "", is_active: true });
  const [error, setError] = useState<string | null>(null);
  const [systemText, setSystemText] = useState("");
  const [systemEditing, setSystemEditing] = useState(false);
  const [systemError, setSystemError] = useState<string | null>(null);

  useEffect(() => {
    if (systemPrompt) {
      setSystemText(systemPrompt.prompt_text);
    }
  }, [systemPrompt]);

  function openCreate() {
    if (!selectedAccountId) return;
    setEditing(null);
    setForm({ prompt_name: "", prompt_type: "", prompt_text: "", is_active: true });
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(p: Prompt) {
    setEditing(p);
    setForm({ prompt_name: p.prompt_name, prompt_type: p.prompt_type ?? "", prompt_text: p.prompt_text, is_active: p.is_active });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!selectedAccountId) return;
    setError(null);
    try {
      if (editing) {
        await updatePrompt.mutateAsync({ id: editing.id, body: form });
      } else {
        await createPrompt.mutateAsync({ account_id: selectedAccountId, ...form, prompt_type: form.prompt_type || null });
      }
      setDialogOpen(false);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  function startSystemEdit() {
    setSystemText(systemPrompt?.prompt_text ?? "");
    setSystemError(null);
    setSystemEditing(true);
  }

  function cancelSystemEdit() {
    setSystemText(systemPrompt?.prompt_text ?? "");
    setSystemError(null);
    setSystemEditing(false);
  }

  async function handleSystemSave() {
    setSystemError(null);
    try {
      await updateSystemPrompt.mutateAsync({ prompt_text: systemText });
      setSystemEditing(false);
    } catch (e) {
      setSystemError(formatUserError(e));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Prompts"
        description="View the built-in system prompt and manage custom prompts per account"
        actions={<Button onClick={openCreate} disabled={!selectedAccountId}><Plus className="mr-2 h-4 w-4" /> New Prompt</Button>}
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Default System Template</CardTitle>
            <CardDescription>
              Used when an account has no active prompt. Include {"{context}"} where knowledge base content should appear.
              {systemPrompt?.updated_at ? ` Last updated ${systemPrompt.updated_at}.` : ""}
            </CardDescription>
          </div>
          {isSuperAdmin && !systemEditing && (
            <Button variant="outline" size="sm" onClick={startSystemEdit} disabled={systemPromptLoading}>
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={systemText}
            onChange={(e) => setSystemText(e.target.value)}
            readOnly={!isSuperAdmin || !systemEditing}
            rows={8}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-default disabled:opacity-100 read-only:bg-muted/30"
            placeholder={systemPromptLoading ? "Loading default system template..." : undefined}
          />
          {isSuperAdmin && systemEditing && (
            <div className="flex items-center gap-2">
              <Button onClick={handleSystemSave} disabled={updateSystemPrompt.isPending || !systemText.trim()}>
                Save
              </Button>
              <Button variant="outline" onClick={cancelSystemEdit} disabled={updateSystemPrompt.isPending}>
                Cancel
              </Button>
            </div>
          )}
          {!isSuperAdmin && (
            <p className="text-sm text-muted-foreground">Only Super Admins can edit the default system template.</p>
          )}
          {systemError && <p className="text-sm text-red-600">{systemError}</p>}
        </CardContent>
      </Card>

      <div className="max-w-xs">
        <Label>Account</Label>
        <Select value={selectedAccountId ?? ""} onChange={(e) => setAccountId(Number(e.target.value))} className="mt-1">
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Custom Prompts</h2>
        <DataTable<Prompt>
        columns={[
          { key: "id", header: "ID", sortable: true },
          { key: "prompt_name", header: "Name", sortable: true },
          { key: "prompt_type", header: "Type", render: (r) => r.prompt_type ?? "—" },
          { key: "version_number", header: "Version", sortable: true },
          { key: "is_active", header: "Active", render: (r) => r.is_active ? <Badge variant="success">Yes</Badge> : <Badge variant="muted">No</Badge> },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }}>
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
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Prompt" : "New Prompt"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.prompt_name} onChange={(e) => setForm({ ...form, prompt_name: e.target.value })} className="mt-1" /></div>
            <div><Label>Type</Label><Input value={form.prompt_type} onChange={(e) => setForm({ ...form, prompt_type: e.target.value })} className="mt-1" placeholder="system, user, etc." /></div>
            <div>
              <Label>Prompt Text</Label>
              <textarea
                value={form.prompt_text}
                onChange={(e) => setForm({ ...form, prompt_text: e.target.value })}
                rows={6}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
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
        title="Delete prompt"
        message="This action cannot be undone."
        destructive
        loading={deletePrompt.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) await deletePrompt.mutateAsync(deleteId); setDeleteId(null); }}
      />
    </div>
  );
}
