import { useRef, useState } from "react";
import { Download, Loader2, Package, Trash2, Upload as UploadIcon } from "lucide-react";
import { formatUserError } from "@/lib/errors";
import { apiDownload } from "@/lib/api-client";
import { useWidgetRelease, useUploadWidgetRelease, useDeleteWidgetRelease } from "@/hooks/useWidgetRelease";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/roles";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function fmtSize(bytes?: number | null): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

export function WidgetDownloadPage() {
  const { user } = useAuth();
  const canManage =
    (user?.roles.includes(ROLES.SUPER_ADMIN) || user?.roles.includes(ROLES.DEVELOPER)) ?? false;

  const { data: release, isLoading } = useWidgetRelease();
  const upload = useUploadWidgetRelease();
  const remove = useDeleteWidgetRelease();

  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleDownload() {
    // Guard against re-entry: a second click while the ~80 MB fetch is in
    // flight would spawn a competing download and slow both down.
    if (downloading) return;
    setDownloadError(null);
    setDownloading(true);
    try {
      await apiDownload("/api/widget-release/download", release?.original_filename || "aiva-widget.exe");
    } catch (e) {
      setDownloadError(formatUserError(e));
    } finally {
      setDownloading(false);
    }
  }

  async function handleUpload() {
    setError(null);
    if (!file) {
      setError("Choose a .exe file to upload.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".exe")) {
      setError("Only .exe files are allowed.");
      return;
    }
    if (!version.trim()) {
      setError("Enter a version.");
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("version", version.trim());
    if (notes.trim()) form.append("notes", notes.trim());
    try {
      await upload.mutateAsync(form);
      setVersion("");
      setNotes("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Package} title="Widget Download" description="Download the latest AIVA widget installer" />

      <div className="rounded-xl border border-border bg-card p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : release ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground">Version {release.version}</p>
              <p className="text-sm text-muted-foreground">
                {release.original_filename} · {fmtSize(release.file_size)}
                {release.uploaded_at ? ` · uploaded ${new Date(release.uploaded_at).toLocaleString()}` : ""}
                {release.uploaded_by_email ? ` by ${release.uploaded_by_email}` : ""}
              </p>
              {release.notes ? <p className="text-sm text-foreground/80">{release.notes}</p> : null}
            </div>
            <Button onClick={handleDownload} disabled={downloading}>
              {downloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing download…
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Download latest
                </>
              )}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No widget has been uploaded yet.</p>
        )}
        {downloading && (
          <p className="mt-3 text-sm text-muted-foreground">
            Fetching the installer{release?.file_size ? ` (${fmtSize(release.file_size)})` : ""} — this can take a
            minute on a slow connection. The save prompt appears once it finishes.
          </p>
        )}
        {downloadError && <p className="mt-3 text-sm text-red-600">{downloadError}</p>}
      </div>

      {canManage && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <UploadIcon className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Upload new version</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="wr-version">Version</Label>
              <Input id="wr-version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. 1.2.0" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="wr-file">Installer (.exe)</Label>
              <Input
                id="wr-file"
                ref={fileRef}
                type="file"
                accept=".exe,application/octet-stream,application/x-msdownload"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="wr-notes">Notes (optional)</Label>
            <Input id="wr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What changed in this version" className="mt-1" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center justify-between">
            <Button onClick={handleUpload} disabled={upload.isPending}>
              <UploadIcon className="mr-2 h-4 w-4" /> {upload.isPending ? "Uploading…" : "Upload & publish"}
            </Button>
            {release && (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} disabled={remove.isPending}>
                <Trash2 className="mr-2 h-4 w-4 text-red-500" /> Remove current
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Uploading replaces the current installer. Max size 300 MB.</p>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Remove widget installer"
        message="Users won't be able to download the widget until a new version is uploaded."
        destructive
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await remove.mutateAsync();
          } finally {
            setConfirmDelete(false);
          }
        }}
      />
    </div>
  );
}
