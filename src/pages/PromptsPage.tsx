import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { formatUserError } from "@/lib/errors";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ROLES } from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  usePrompts,
  useCreatePrompt,
  useUpdatePrompt,
  useDeletePrompt,
  useSystemPrompt,
  useUpdateSystemPrompt,
} from "@/hooks/usePrompts";
import { Page, PageHeading } from "@/components/shell/page";
import { DataTable, actionsColumn, type Column } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { Status } from "@/components/data/status";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Badge } from "@/components/ui/badge";
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
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { RelativeTime } from "@/components/doc-intel/RelativeTime";
import type { Prompt } from "@/types/api";

type PromptRow = Prompt & { versionCount: number };

/** Rows sharing a prompt name are versions of one prompt; newest version first. */
function versionsOf(prompts: Prompt[], name: string): Prompt[] {
  return prompts.filter((p) => p.prompt_name === name).sort((a, b) => b.version_number - a.version_number);
}

function charCount(text: string): string {
  return `${formatNumber(text.length)} characters`;
}

export function PromptsPage() {
  const { user } = useAuth();
  const workspace = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const canEditSystemPrompt = isSuperAdmin || user?.roles.includes(ROLES.DEVELOPER) === true;
  const selectedAccountId = workspace.accountId;
  const { data = [], isLoading, isError, error: loadError, refetch } = usePrompts(selectedAccountId);
  const { data: systemPrompt, isLoading: systemPromptLoading } = useSystemPrompt();
  const createPrompt = useCreatePrompt();
  const updatePrompt = useUpdatePrompt();
  const deletePrompt = useDeletePrompt();
  const updateSystemPrompt = useUpdateSystemPrompt();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Prompt | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [form, setForm] = useState({ prompt_name: "", prompt_type: "", prompt_text: "", is_active: true });
  const [error, setError] = useState<string | null>(null);
  const [systemText, setSystemText] = useState("");
  const [systemEditing, setSystemEditing] = useState(false);
  const [systemError, setSystemError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [view, setView] = useState<"latest" | "all">("latest");

  useEffect(() => {
    if (systemPrompt) {
      setSystemText(systemPrompt.prompt_text);
    }
  }, [systemPrompt]);

  // ?action=create (command palette): open the create dialog once an account is available, then drop the param.
  useEffect(() => {
    if (searchParams.get("action") !== "create" || workspace.isLoading) return;
    if (selectedAccountId != null) openCreate();
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("action");
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, workspace.isLoading, selectedAccountId]);

  const rows = useMemo<PromptRow[]>(() => {
    const counts = new Map<string, number>();
    for (const p of data) counts.set(p.prompt_name, (counts.get(p.prompt_name) ?? 0) + 1);
    const withCount = data.map((p) => ({ ...p, versionCount: counts.get(p.prompt_name) ?? 1 }));
    const scoped =
      view === "all"
        ? withCount
        : [...new Set(data.map((p) => p.prompt_name))].map((name) => {
            const latest = versionsOf(data, name)[0];
            return { ...latest, versionCount: counts.get(name) ?? 1 };
          });
    const q = search.trim().toLowerCase();
    return q
      ? scoped.filter((p) => [p.prompt_name, p.prompt_type ?? "", p.prompt_text].join(" ").toLowerCase().includes(q))
      : scoped;
  }, [data, view, search]);

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
        toast.success("Prompt saved", { description: form.prompt_name });
      } else {
        await createPrompt.mutateAsync({ account_id: selectedAccountId, ...form, prompt_type: form.prompt_type || null });
        toast.success("Prompt created", { description: form.prompt_name });
      }
      setDialogOpen(false);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deletePrompt.mutateAsync(deleteTarget.id);
      toast.success("Prompt deleted", { description: `${deleteTarget.prompt_name} v${deleteTarget.version_number}` });
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(formatUserError(e));
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
      toast.success("Default system template saved");
    } catch (e) {
      setSystemError(formatUserError(e));
    }
  }

  const columns: Column<PromptRow>[] = [
    {
      key: "prompt_name",
      header: "Name",
      sortable: true,
      sortValue: (r) => r.prompt_name.toLowerCase(),
      render: (r) => (
        <span className="inline-flex min-w-0 max-w-[24rem] items-center gap-2">
          <span className="truncate font-medium text-foreground" title={r.prompt_name}>
            <bdi>{r.prompt_name}</bdi>
          </span>
          {view === "latest" && r.versionCount > 1 && (
            <Badge variant="neutral" className="shrink-0">
              {r.versionCount} versions
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: "prompt_type",
      header: "Type",
      sortable: true,
      render: (r) => (r.prompt_type ? <Badge variant="outline">{r.prompt_type}</Badge> : <span className="text-muted-foreground">—</span>),
    },
    {
      key: "version_number",
      header: "Version",
      sortable: true,
      render: (r) => <span className="font-mono text-xs">v{r.version_number}</span>,
    },
    {
      key: "is_active",
      header: "Status",
      sortable: true,
      sortValue: (r) => (r.is_active ? 0 : 1),
      render: (r) => <Status tone={r.is_active ? "success" : "neutral"} label={r.is_active ? "Active" : "Inactive"} />,
    },
    { key: "created_at", header: "Created", sortable: true, render: (r) => <RelativeTime value={r.created_at} /> },
    { key: "id", header: "ID", sortable: true, defaultHidden: true, render: (r) => <span className="font-mono text-xs">#{r.id}</span> },
    actionsColumn<PromptRow>(
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
      { label: (r) => `Actions for ${r.prompt_name} v${r.version_number}` },
    ),
  ];

  const editingVersions = editing ? versionsOf(data, editing.prompt_name) : [];
  const saving = createPrompt.isPending || updatePrompt.isPending;
  const accountName = workspace.account?.name;

  return (
    <Page width="default">
      <PageHeading
        title="Prompts"
        description={
          accountName
            ? `The default system template and the custom prompts of ${accountName}.`
            : "The default system template and custom prompts per account."
        }
        actions={
          <Button onClick={openCreate} disabled={!selectedAccountId}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            New prompt
          </Button>
        }
      />

      <section className="space-y-3" aria-labelledby="system-template-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 id="system-template-heading" className="text-base font-semibold text-foreground">
              Default system template
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Used when an account has no active prompt. Include <code className="font-mono text-ui text-foreground">{"{context}"}</code>{" "}
              where knowledge-base content should appear.
            </p>
          </div>
          {canEditSystemPrompt && !systemEditing && (
            <Button variant="outline" size="sm" onClick={startSystemEdit} disabled={systemPromptLoading}>
              <Pencil aria-hidden="true" className="h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
        {systemPromptLoading ? (
          <Skeleton className="h-52 w-full" />
        ) : (
          <Textarea
            mono
            aria-label="Default system template"
            value={systemText}
            onChange={(e) => setSystemText(e.target.value)}
            readOnly={!canEditSystemPrompt || !systemEditing}
            rows={10}
            dir="auto"
            className={cn("min-h-[12rem]", (!canEditSystemPrompt || !systemEditing) && "resize-none")}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {charCount(systemText)}
            {systemPrompt?.updated_at ? ` · Last updated ${formatDateTime(systemPrompt.updated_at)}` : ""}
            {!canEditSystemPrompt ? " · Only Super Admins and Developers can edit the default system template." : ""}
          </p>
          {canEditSystemPrompt && systemEditing && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={cancelSystemEdit} disabled={updateSystemPrompt.isPending}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSystemSave} disabled={!systemText.trim()} loading={updateSystemPrompt.isPending}>
                Save template
              </Button>
            </div>
          )}
        </div>
        <ErrorAlert message={systemError} />
      </section>

      <section className="space-y-3" aria-labelledby="custom-prompts-heading">
        <div>
          <h2 id="custom-prompts-heading" className="text-base font-semibold text-foreground">
            Custom prompts
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Rows with the same name are versions of one prompt; the active one is used for this account's answers.
          </p>
        </div>

        {!workspace.isLoading && selectedAccountId == null ? (
          <EmptyState
            icon={Building2}
            title="No account selected"
            description="Custom prompts belong to an account. Choose one in the sidebar."
          />
        ) : (
          <DataTable<PromptRow>
            aria-label="Custom prompts"
            columns={columns}
            data={isError ? [] : rows}
            keyFn={(r) => r.id}
            loading={isLoading || workspace.isLoading}
            itemLabel={view === "latest" ? "prompts" : "versions"}
            defaultSort={{ key: "prompt_name", dir: "asc" }}
            onRowClick={openEdit}
            enableColumnVisibility
            persistKey="prompts"
            empty={
              isError
                ? {
                    title: "Couldn't load prompts",
                    description: formatUserError(loadError),
                    action: (
                      <Button variant="outline" size="sm" onClick={() => void refetch()}>
                        Try again
                      </Button>
                    ),
                  }
                : search.trim()
                  ? {
                      title: "No prompts match your search",
                      action: (
                        <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                          Clear search
                        </Button>
                      ),
                    }
                  : {
                      icon: FileText,
                      title: "No custom prompts yet",
                      description: "This account uses the default system template.",
                      action: (
                        <Button variant="outline" size="sm" onClick={openCreate} disabled={!selectedAccountId}>
                          <Plus aria-hidden="true" className="h-4 w-4" />
                          New prompt
                        </Button>
                      ),
                    }
            }
            toolbar={
              <FilterBar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search name, type or text…"
                onClear={() => setSearch("")}
                actions={
                  <Tabs variant="segmented" value={view} onValueChange={(v) => setView(v as "latest" | "all")}>
                    <TabsList aria-label="Versions shown">
                      <TabsTrigger value="latest">Latest versions</TabsTrigger>
                      <TabsTrigger value="all">All versions</TabsTrigger>
                    </TabsList>
                  </Tabs>
                }
              />
            }
          />
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} size="lg">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? (
                <>
                  Edit prompt <span className="font-mono text-sm font-normal text-muted-foreground">v{editing.version_number}</span>
                </>
              ) : (
                "New prompt"
              )}
            </DialogTitle>
            <DialogDescription>
              {editing ? `Created ${formatDateTime(editing.created_at)}${accountName ? ` · ${accountName}` : ""}` : accountName ? `For ${accountName}` : undefined}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <FieldGroup columns={2}>
              <Field label="Name" htmlFor="prompt-name">
                <Input id="prompt-name" dir="auto" value={form.prompt_name} onChange={(e) => setForm({ ...form, prompt_name: e.target.value })} />
              </Field>
              <Field label="Type" htmlFor="prompt-type">
                <Input
                  id="prompt-type"
                  value={form.prompt_type}
                  onChange={(e) => setForm({ ...form, prompt_type: e.target.value })}
                  placeholder="system, user, etc."
                />
              </Field>
            </FieldGroup>
            <Field
              label="Prompt text"
              htmlFor="prompt-text"
              labelAction={<span className="text-xs tabular-nums text-muted-foreground">{charCount(form.prompt_text)}</span>}
            >
              <Textarea
                id="prompt-text"
                mono
                dir="auto"
                value={form.prompt_text}
                onChange={(e) => setForm({ ...form, prompt_text: e.target.value })}
                rows={14}
                className="min-h-[16rem]"
              />
            </Field>
            <Field orientation="horizontal" label="Active" htmlFor="prompt-active" hint="The active prompt is used for this account's answers.">
              <Switch id="prompt-active" checked={form.is_active} onCheckedChange={(on) => setForm({ ...form, is_active: on })} />
            </Field>

            {editing && editingVersions.length > 1 && (
              <section className="space-y-2 border-t border-border pt-4" aria-labelledby="prompt-versions-heading">
                <h3 id="prompt-versions-heading" className="text-sm font-semibold text-foreground">
                  Versions of this prompt
                </h3>
                <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                  {editingVersions.map((v) => {
                    const current = v.id === editing.id;
                    return (
                      <li key={v.id} className={cn("flex items-center gap-3 px-3 py-2 text-ui", current && "bg-primary-muted/50")}>
                        <span className="w-10 font-mono text-xs text-foreground">v{v.version_number}</span>
                        <Status tone={v.is_active ? "success" : "neutral"} label={v.is_active ? "Active" : "Inactive"} />
                        <RelativeTime value={v.created_at} className="text-muted-foreground" />
                        <span className="ml-auto">
                          {current ? (
                            <span className="text-xs font-medium text-primary-muted-foreground">Editing</span>
                          ) : (
                            <Button variant="link" size="sm" className="h-6 px-0" onClick={() => openEdit(v)}>
                              Open
                            </Button>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <ErrorAlert message={error} />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete prompt?"
        message={
          deleteTarget
            ? `“${deleteTarget.prompt_name}” version ${deleteTarget.version_number} will be deleted. This action cannot be undone.`
            : "This action cannot be undone."
        }
        confirmLabel="Delete"
        loadingLabel="Deleting…"
        destructive
        loading={deletePrompt.isPending}
        error={deleteError}
        onCancel={() => {
          if (deletePrompt.isPending) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={confirmDelete}
      />
    </Page>
  );
}
