import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DOC_MIME_TYPES, formatBytes, type FileUploadState, type UploadLimits } from "@/lib/doc-intel";
import { Status, type StatusTone } from "@/components/data/status";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  limits: UploadLimits;
  disabled?: boolean;
  /** Per-file upload progress, shown on each row (files without an entry show no status). */
  fileStates?: ReadonlyMap<File, FileUploadState>;
};

const STATE_VIEW: Record<FileUploadState["status"], { tone: StatusTone; label: string; pulse?: boolean }> = {
  waiting: { tone: "neutral", label: "Waiting" },
  uploading: { tone: "warning", label: "Uploading", pulse: true },
  accepted: { tone: "success", label: "Accepted" },
  rejected: { tone: "danger", label: "Rejected" },
  failed: { tone: "danger", label: "Upload failed" },
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * Drag-and-drop / click-to-select file picker. Files are pre-checked against the server's
 * limits (type, size, count); anything that fails is listed inline and not added.
 */
export function FileDropzone({ files, onChange, limits, disabled = false, fileStates }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [dragActive, setDragActive] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const allowed = limits.allowedExtensions;
  const accept = [...allowed, ...allowed.map((ext) => DOC_MIME_TYPES[ext]).filter(Boolean)].join(",");
  const typeNames = allowed.map((ext) => ext.replace(/^\./, "").toUpperCase()).join(" or ");
  const maxBytes = limits.maxUploadMb * 1024 * 1024;
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  // A cleared selection (e.g. after an upload) also clears the old messages.
  useEffect(() => {
    if (files.length === 0) setProblems([]);
  }, [files.length]);

  function addFiles(incoming: File[]) {
    if (disabled || incoming.length === 0) return;
    const next = [...files];
    const seen = new Set(next.map(fileKey));
    const issues: string[] = [];
    let overCount = 0;
    for (const file of incoming) {
      if (!allowed.includes(extensionOf(file.name))) {
        issues.push(`${file.name}: unsupported file type (only ${typeNames}).`);
      } else if (file.size === 0) {
        issues.push(`${file.name}: the file is empty.`);
      } else if (file.size > maxBytes) {
        issues.push(`${file.name}: file is ${formatBytes(file.size)}; the limit is ${limits.maxUploadMb} MB.`);
      } else if (seen.has(fileKey(file))) {
        issues.push(`${file.name}: already selected.`);
      } else if (next.length >= limits.maxFiles) {
        overCount += 1;
      } else {
        seen.add(fileKey(file));
        next.push(file);
      }
    }
    if (overCount > 0) {
      issues.push(
        `${overCount} ${overCount === 1 ? "file was" : "files were"} not added — at most ${limits.maxFiles} files per upload.`,
      );
    }
    setProblems(issues);
    if (next.length !== files.length) onChange(next);
  }

  function removeFile(file: File) {
    if (disabled) return;
    setProblems([]);
    onChange(files.filter((f) => f !== file));
  }

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function handleDragOver(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = disabled ? "none" : "copy";
    if (!disabled && !dragActive) setDragActive(true);
  }

  function handleDragLeave(e: DragEvent<HTMLElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragActive(false);
  }

  function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragActive(false);
    addFiles(Array.from(e.dataTransfer.files));
  }

  return (
    <div className="space-y-3">
      {/* aria-disabled rather than disabled: a disabled button swallows drag events, and a
          drop that nobody handles makes the browser navigate to the file. */}
      <button
        type="button"
        onClick={openPicker}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-disabled={disabled || undefined}
        aria-describedby={hintId}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          disabled
            ? "cursor-not-allowed border-input bg-surface-muted opacity-60"
            : dragActive
              ? "border-primary bg-primary-muted"
              : "border-input bg-surface-muted hover:border-primary/60 hover:bg-primary-muted/50",
        )}
      >
        <span aria-hidden="true" className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-primary">
          <Upload className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-foreground">
          Drop files here or <span className="text-primary underline underline-offset-2">browse</span>
        </span>
        <span id={hintId} className="text-xs text-muted-foreground">
          {typeNames} · up to {limits.maxUploadMb} MB each · at most {limits.maxFiles} files per upload
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        tabIndex={-1}
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          // Reset so picking the same file again (after removing it) still fires onChange.
          e.target.value = "";
        }}
      />

      {problems.length > 0 && (
        <Alert tone="warning" role="alert" title="Some files were not added">
          <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-ui">
            {problems.map((message, i) => (
              <li key={i} className="[overflow-wrap:anywhere]">
                {message}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {files.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {files.length} {files.length === 1 ? "file" : "files"} · {formatBytes(totalBytes)}
            </span>
            <Button variant="link" size="sm" className="h-6 px-0 text-xs" onClick={() => onChange([])} disabled={disabled}>
              Remove all
            </Button>
          </div>
          <ul aria-label="Selected files" className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
            {files.map((file) => {
              const state = fileStates?.get(file);
              const view = state ? STATE_VIEW[state.status] : null;
              return (
                <li key={fileKey(file)} className="flex items-start gap-3 px-3 py-2">
                  <FileText aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ui text-foreground" title={file.name}>
                      <bdi>{file.name}</bdi>
                    </p>
                    {state && view && (
                      <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2">
                        <Status tone={view.tone} label={view.label} pulse={view.pulse} className="text-xs" />
                        {"reason" in state && (
                          <span className="min-w-0 break-words text-xs text-danger" dir="auto">
                            {state.reason}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="mt-0.5 shrink-0 text-xs tabular-nums text-muted-foreground">{formatBytes(file.size)}</span>
                  <IconButton
                    label={`Remove ${file.name}`}
                    icon={X}
                    size="sm"
                    className="-my-1 h-7 w-7"
                    onClick={() => removeFile(file)}
                    disabled={disabled}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
