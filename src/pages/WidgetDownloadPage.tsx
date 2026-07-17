import { useState } from "react";
import { Download, Loader2, Package } from "lucide-react";
import { formatUserError } from "@/lib/errors";
import { apiDownload } from "@/lib/api-client";
import { useWidgetRelease } from "@/hooks/useWidgetRelease";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

function fmtSize(bytes?: number | null): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

export function WidgetDownloadPage() {
  const { data: release, isLoading } = useWidgetRelease();

  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    // Guard against re-entry: a second click while the ~84 MB fetch is in
    // flight would spawn a competing download and slow both down.
    if (downloading) return;
    setDownloadError(null);
    setDownloading(true);
    try {
      await apiDownload("/api/widget-release/download", release?.original_filename || "Aiva-Setup.exe");
    } catch (e) {
      setDownloadError(formatUserError(e));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Package} title="Widget Download" description="Download and install the AIVA desktop widget for Windows" />

      <div className="rounded-xl border border-border bg-card p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : release ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground">AIVA Widget · Version {release.version}</p>
              <p className="text-sm text-muted-foreground">
                {release.original_filename} · {fmtSize(release.file_size)} · Windows
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
                  <Download className="mr-2 h-4 w-4" /> Download for Windows
                </>
              )}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">The widget installer is not available right now.</p>
        )}
        {downloading && (
          <p className="mt-3 text-sm text-muted-foreground">
            Fetching the installer{release?.file_size ? ` (${fmtSize(release.file_size)})` : ""} — this can take a
            minute on a slow connection. The save prompt appears once it finishes.
          </p>
        )}
        {downloadError && <p className="mt-3 text-sm text-red-600">{downloadError}</p>}
      </div>

      {release ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <h3 className="mb-2 text-sm font-semibold text-foreground">How to install</h3>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Click <span className="font-medium text-foreground">Download for Windows</span> and save the file.</li>
            <li>Open <span className="font-medium text-foreground">{release.original_filename}</span> and follow the installer.</li>
            <li>Launch <span className="font-medium text-foreground">Aiva</span> and sign in with your AIVA account.</li>
          </ol>
        </div>
      ) : null}
    </div>
  );
}
