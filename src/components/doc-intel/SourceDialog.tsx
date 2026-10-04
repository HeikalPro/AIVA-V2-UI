import { useId, useMemo, useState, type FormEvent } from "react";
import { useAccounts } from "@/hooks/useAccounts";
import { useCreateSource, useUpdateSource } from "@/hooks/useSharePointSync";
import {
  DEFAULT_FILE_EXTENSIONS,
  DEFAULT_SYNC_INTERVAL_DAYS,
  SYNC_FILE_TYPES,
  checkSiteUrl,
  describeActionError,
  scheduleDraftDays,
  scheduleDraftFrom,
  type ActionProblem,
  type ScheduleDraft,
} from "@/lib/sharepoint-sync";
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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { ToggleChip } from "@/components/widget-config/ToggleChip";
import { Notice } from "@/components/doc-intel/Notice";
import { SecretBadge } from "@/components/doc-intel/SyncBadges";
import { SyncScheduleField } from "@/components/doc-intel/SyncScheduleField";
import type { Account, SourceCreate, SourceOut, SourceUpdate } from "@/types/api";

/** Everything editable except the client secret, which lives in its own state and is never part of a diff. */
type Draft = {
  name: string;
  accountId: string;
  tenantId: string;
  clientId: string;
  siteUrl: string;
  driveName: string;
  folderPath: string;
  recursive: boolean;
  extensions: string[];
  schedule: ScheduleDraft;
};

type FieldKey =
  | "name"
  | "tenantId"
  | "clientId"
  | "secret"
  | "siteUrl"
  | "driveName"
  | "folderPath"
  | "extensions"
  | "interval";

type Errors = Partial<Record<FieldKey, string>>;

function draftFrom(source: SourceOut | null): Draft {
  return {
    name: source?.name ?? "",
    accountId: source?.account_id != null ? String(source.account_id) : "",
    tenantId: source?.tenant_id ?? "",
    clientId: source?.client_id ?? "",
    siteUrl: source?.site_url ?? "",
    driveName: source?.drive_name ?? "",
    folderPath: source?.folder_path ?? "",
    recursive: source?.recursive ?? true,
    extensions: source?.file_extensions?.length ? [...source.file_extensions] : [...DEFAULT_FILE_EXTENSIONS],
    schedule: scheduleDraftFrom(source),
  };
}

function sameSet(a: string[], b: string[]): boolean {
  return [...a].sort().join("\u0000") === [...b].sort().join("\u0000");
}

function accountLabel(a: Pick<Account, "name" | "organization_name" | "organization_id">): string {
  return `${a.organization_name ?? `Org #${a.organization_id}`} · ${a.name}`;
}

/** Interval to send: the draft's, else (schedule off with an unfinished custom value) the saved one. */
function intervalToSend(draft: Draft, source: SourceOut | null): number | null {
  const days = scheduleDraftDays(draft.schedule);
  if (days != null) return days;
  return draft.schedule.enabled ? null : (source?.sync_interval_days ?? DEFAULT_SYNC_INTERVAL_DAYS);
}

/** True when the credentials on file are unreadable and the admin has started to replace them. */
function replacingUnreadable(draft: Draft, secret: string, source: SourceOut | null): boolean {
  if (!source || source.credentials_readable !== false) return false;
  return (
    draft.tenantId.trim() !== (source.tenant_id ?? "") ||
    draft.clientId.trim() !== (source.client_id ?? "") ||
    secret.trim() !== ""
  );
}

function validate(draft: Draft, secret: string, source: SourceOut | null): Errors {
  const errors: Errors = {};
  const name = draft.name.trim();
  if (!name) errors.name = "Enter a name for this source.";
  else if (name.length > 200) errors.name = "Use at most 200 characters.";

  const replacing = replacingUnreadable(draft, secret, source);
  const idsRequired = !source || source.credentials_readable !== false || replacing;
  const tenant = draft.tenantId.trim();
  const client = draft.clientId.trim();
  if (idsRequired && !tenant) errors.tenantId = "Enter the Directory (tenant) ID.";
  else if (tenant.length > 200) errors.tenantId = "Use at most 200 characters.";
  if (idsRequired && !client) errors.clientId = "Enter the Application (client) ID.";
  else if (client.length > 200) errors.clientId = "Use at most 200 characters.";

  const secretRequired = !source || replacing || !source.client_secret_set;
  if (secretRequired && !secret.trim()) {
    errors.secret = source ? "Enter the client secret again: the stored one can't be used." : "Enter the client secret.";
  } else if (secret.trim().length > 1024) {
    errors.secret = "The client secret is too long (at most 1024 characters).";
  }

  const site = checkSiteUrl(draft.siteUrl);
  if (site.error) errors.siteUrl = site.error;
  else if (draft.siteUrl.trim().length > 1000) errors.siteUrl = "Use at most 1000 characters.";
  if (draft.driveName.trim().length > 200) errors.driveName = "Use at most 200 characters.";
  if (draft.folderPath.trim().length > 1000) errors.folderPath = "Use at most 1000 characters.";
  if (draft.extensions.length === 0) errors.extensions = "Select at least one file type.";
  if (intervalToSend(draft, source) == null) errors.interval = "Enter a whole number of days from 1 to 365.";
  return errors;
}

function createBody(draft: Draft, secret: string): SourceCreate {
  return {
    name: draft.name.trim(),
    account_id: draft.accountId ? Number(draft.accountId) : null,
    tenant_id: draft.tenantId.trim(),
    client_id: draft.clientId.trim(),
    client_secret: secret.trim(),
    site_url: draft.siteUrl.trim(),
    drive_name: draft.driveName.trim() || null,
    folder_path: draft.folderPath.trim() || null,
    recursive: draft.recursive,
    file_extensions: [...draft.extensions],
    sync_enabled: draft.schedule.enabled,
    sync_interval_days: intervalToSend(draft, null) ?? DEFAULT_SYNC_INTERVAL_DAYS,
    sync_hour: draft.schedule.hour,
  };
}

/** Only the fields that changed; client_secret only when a new one was typed (omitted = keep). */
function updateBody(draft: Draft, secret: string, source: SourceOut): SourceUpdate {
  const body: SourceUpdate = {};
  const name = draft.name.trim();
  if (name !== source.name) body.name = name;
  const accountId = draft.accountId ? Number(draft.accountId) : null;
  if (accountId !== (source.account_id ?? null)) body.account_id = accountId;
  const tenant = draft.tenantId.trim();
  if (tenant && tenant !== (source.tenant_id ?? "")) body.tenant_id = tenant;
  const client = draft.clientId.trim();
  if (client && client !== (source.client_id ?? "")) body.client_id = client;
  if (secret.trim()) body.client_secret = secret.trim();
  const site = draft.siteUrl.trim();
  if (site !== (source.site_url ?? "")) body.site_url = site;
  const drive = draft.driveName.trim() || null;
  if (drive !== (source.drive_name?.trim() || null)) body.drive_name = drive;
  const folder = draft.folderPath.trim() || null;
  if (folder !== (source.folder_path?.trim() || null)) body.folder_path = folder;
  if (draft.recursive !== source.recursive) body.recursive = draft.recursive;
  if (!sameSet(draft.extensions, source.file_extensions ?? [])) body.file_extensions = [...draft.extensions];
  if (draft.schedule.enabled !== source.sync_enabled) body.sync_enabled = draft.schedule.enabled;
  const days = intervalToSend(draft, source);
  if (days != null && days !== source.sync_interval_days) body.sync_interval_days = days;
  if (draft.schedule.hour !== source.sync_hour) body.sync_hour = draft.schedule.hour;
  return body;
}

type Props = {
  /** The source to edit; null to connect a new folder. */
  source: SourceOut | null;
  /** DOC_INTEL_SECRETS_KEY is set (from /status); false shows why saving credentials fails. */
  secretsKeyConfigured?: boolean;
  /** DOC_INTEL_SCHEDULER_ENABLED (from /status). */
  schedulerEnabled?: boolean;
  onClose: () => void;
  onSaved?: (source: SourceOut) => void;
};

/**
 * Create or edit a SharePoint / OneDrive source. The client secret is write-only: never prefilled,
 * `new-password` so browsers don't autofill it, omitted from an edit when left blank, and cleared
 * as soon as the save succeeds.
 */
export function SourceDialog({ source, secretsKeyConfigured = true, schedulerEnabled = true, onClose, onSaved }: Props) {
  const uid = useId();
  const editing = source != null;
  const accounts = useAccounts(null);
  const create = useCreateSource();
  const update = useUpdateSource();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(source));
  const [secret, setSecret] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [problem, setProblem] = useState<ActionProblem | null>(null);
  const saving = create.isPending || update.isPending;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const ids = (key: string) => `${uid}-${key}`;

  const accountOptions = useMemo(() => {
    const list = [...(accounts.data ?? [])].sort((a, b) =>
      accountLabel(a).localeCompare(accountLabel(b), undefined, { sensitivity: "base" }),
    );
    const options = list.map((a) => ({ value: String(a.id), label: accountLabel(a) }));
    // Keep the saved account selectable even when it is no longer listed.
    if (source?.account_id != null && !options.some((o) => o.value === String(source.account_id))) {
      options.unshift({ value: String(source.account_id), label: source.account_name ?? `Account #${source.account_id}` });
    }
    return options;
  }, [accounts.data, source]);

  const errors = validate(draft, secret, source);
  const hasErrors = Object.keys(errors).length > 0;
  // The custom interval is checked as it is typed; everything else once Save has been pressed.
  const shownErrors: Errors = submitted
    ? errors
    : draft.schedule.interval === "custom"
      ? { interval: errors.interval }
      : {};
  const siteCheck = checkSiteUrl(draft.siteUrl);
  const body = editing ? updateBody(draft, secret, source) : null;
  // An invalid edit (e.g. a custom interval of 0) produces no diff, but it is still a change to report.
  const noChanges = editing && body != null && Object.keys(body).length === 0 && !hasErrors;
  const scheduleChanged =
    !editing ||
    draft.schedule.enabled !== source.sync_enabled ||
    (draft.schedule.enabled &&
      (scheduleDraftDays(draft.schedule) !== source.sync_interval_days || draft.schedule.hour !== source.sync_hour));
  const unreadable = editing && source.credentials_readable === false;

  function close() {
    if (saving) return;
    setSecret("");
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setProblem(null);
    if (saving || hasErrors || noChanges) return;
    try {
      const saved = editing
        ? await update.mutateAsync({ id: source.id, body: updateBody(draft, secret, source) })
        : await create.mutateAsync(createBody(draft, secret));
      // Drop the secret from component state and from the finished mutation (gcTime 0 removes it).
      setSecret("");
      create.reset();
      update.reset();
      toast.success(editing ? "Source updated" : "Folder connected", { description: saved?.name ?? draft.name.trim() });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setProblem(describeActionError(err, editing ? "Saving the changes" : "Connecting the folder"));
      // The failed mutation holds the secret in its variables; the typed value stays in the field for a retry.
      create.reset();
      update.reset();
    }
  }

  const siteWarning = draft.siteUrl.trim() ? (siteCheck.warning ?? (submitted ? null : siteCheck.error)) : null;
  const optional = (label: string) => (
    <>
      {label} <span className="font-normal text-muted-foreground">(optional)</span>
    </>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && close()} size="lg">
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="break-words">{editing ? `Edit “${source.name}”` : "Connect a SharePoint folder"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Changes apply to the next sync. Leave the client secret blank to keep the stored one."
              : "AIVA reads the folder with a Microsoft Entra app (read-only) and extracts CRM entities from its files."}
          </DialogDescription>
        </DialogHeader>

        <form id={ids("form")} onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-6">
            {!secretsKeyConfigured && (
              <Notice tone="danger" title="Set DOC_INTEL_SECRETS_KEY on the server before saving credentials">
                Credentials are stored encrypted with this key. Until it is set and the backend restarted, saving a client secret,
                Tenant ID or Client ID fails.
              </Notice>
            )}
            {unreadable && (
              <Notice tone="warning" title="The stored credentials can't be decrypted">
                The server's encryption key is missing or was rotated. Enter the Tenant ID, Client ID and client secret again to
                repair this source.
              </Notice>
            )}

            <FormSection
              title="Connection"
              description="A Microsoft Entra app registration with the Sites.Read.All and Files.Read.All application permissions (admin consent granted)."
            >
              <FieldGroup columns={2}>
                <Field label="Name" htmlFor={ids("name")} error={shownErrors.name} required>
                  <Input
                    id={ids("name")}
                    value={draft.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Sales contracts"
                    maxLength={200}
                    disabled={saving}
                  />
                </Field>
                <Field label={optional("Account")} htmlFor={ids("account")} hint="The AIVA account the extracted CRM entities belong to.">
                  <Select id={ids("account")} value={draft.accountId} onChange={(e) => set("accountId", e.target.value)} disabled={saving}>
                    <option value="">None</option>
                    {accountOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Tenant ID" htmlFor={ids("tenant")} hint="Directory (tenant) ID" error={shownErrors.tenantId}>
                  <Input
                    id={ids("tenant")}
                    value={draft.tenantId}
                    onChange={(e) => set("tenantId", e.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    maxLength={200}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={saving}
                    className="font-mono text-ui"
                  />
                </Field>
                <Field label="Client ID" htmlFor={ids("client")} hint="Application (client) ID" error={shownErrors.clientId}>
                  <Input
                    id={ids("client")}
                    value={draft.clientId}
                    onChange={(e) => set("clientId", e.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    maxLength={200}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={saving}
                    className="font-mono text-ui"
                  />
                </Field>
              </FieldGroup>
              <Field
                label="Client secret"
                htmlFor={ids("secret")}
                error={shownErrors.secret}
                hint="The secret's Value (not its ID) from Certificates & secrets. Write-only: it is stored encrypted and never shown again."
                labelAction={editing && source.client_secret_set ? <SecretBadge source={source} /> : undefined}
              >
                <Input
                  id={ids("secret")}
                  type="password"
                  autoComplete="new-password"
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  data-1p-ignore=""
                  data-lpignore="true"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={editing ? "Leave blank to keep the current secret" : "Paste the client secret"}
                  maxLength={1024}
                  disabled={saving}
                />
              </Field>
            </FormSection>

            <FormSection title="Location" description="The SharePoint site, library and folder to read.">
              <Field
                label="Site URL"
                htmlFor={ids("site")}
                error={shownErrors.siteUrl}
                hint={
                  siteWarning && !shownErrors.siteUrl ? (
                    <span className="text-warning">{siteWarning}</span>
                  ) : (
                    "The SharePoint site (https://…sharepoint.com/sites/…) or a OneDrive for Business site."
                  )
                }
              >
                <Input
                  id={ids("site")}
                  type="url"
                  inputMode="url"
                  value={draft.siteUrl}
                  onChange={(e) => set("siteUrl", e.target.value)}
                  placeholder="https://contoso.sharepoint.com/sites/Sales"
                  maxLength={1000}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={saving}
                  className="font-mono text-ui"
                />
              </Field>
              <FieldGroup columns={2}>
                <Field label={optional("Library")} htmlFor={ids("drive")} error={shownErrors.driveName} hint="Leave empty for the site's default library.">
                  <Input
                    id={ids("drive")}
                    value={draft.driveName}
                    onChange={(e) => set("driveName", e.target.value)}
                    placeholder="Documents"
                    maxLength={200}
                    autoComplete="off"
                    disabled={saving}
                  />
                </Field>
                <Field
                  label={optional("Folder path")}
                  htmlFor={ids("folder")}
                  error={shownErrors.folderPath}
                  hint="Inside the library. Leave empty for the whole library."
                >
                  <Input
                    id={ids("folder")}
                    value={draft.folderPath}
                    onChange={(e) => set("folderPath", e.target.value)}
                    placeholder="/CRM/Contracts"
                    maxLength={1000}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={saving}
                    className="font-mono text-ui"
                  />
                </Field>
              </FieldGroup>
              <Field orientation="horizontal" label="Include subfolders" htmlFor={ids("recursive")} hint="Also sync files in folders below this one.">
                <Switch id={ids("recursive")} checked={draft.recursive} onCheckedChange={(on) => set("recursive", on)} disabled={saving} />
              </Field>
            </FormSection>

            <FormSection
              title="Processing"
              description="Matching files are downloaded, extracted and run through CRM intelligence and entity extraction."
            >
              <div role="group" aria-labelledby={ids("types")} className="space-y-2">
                <Label id={ids("types")}>File types</Label>
                <div className="flex flex-wrap gap-2">
                  {SYNC_FILE_TYPES.map(({ ext, label }) => {
                    const on = draft.extensions.includes(ext);
                    return (
                      <ToggleChip
                        key={ext}
                        pressed={on}
                        disabled={saving}
                        onPressedChange={() => set("extensions", on ? draft.extensions.filter((x) => x !== ext) : [...draft.extensions, ext])}
                      >
                        {label}
                      </ToggleChip>
                    );
                  })}
                </div>
                {shownErrors.extensions && <p className="text-xs font-medium text-danger">{shownErrors.extensions}</p>}
              </div>
            </FormSection>

            <FormSection title="Schedule">
              <SyncScheduleField
                value={draft.schedule}
                onChange={(schedule) => set("schedule", schedule)}
                nextSyncAt={editing ? source.next_sync_at : null}
                changed={scheduleChanged}
                intervalError={shownErrors.interval}
                schedulerEnabled={schedulerEnabled}
                disabled={saving}
              />
            </FormSection>

            {problem && (
              <Notice tone={problem.tone} title={problem.title}>
                {problem.message}
              </Notice>
            )}
          </DialogBody>

          <DialogFooter>
            {submitted && hasErrors ? (
              <p className="mr-auto text-xs font-medium text-danger">Fix the highlighted fields.</p>
            ) : noChanges ? (
              <p className="mr-auto text-xs text-muted-foreground">No changes yet.</p>
            ) : null}
            <Button type="button" variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={noChanges} loading={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Connect folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
