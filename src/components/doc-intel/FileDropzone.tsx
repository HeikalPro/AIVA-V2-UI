import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { CheckCircle2, Clock, FileText, Loader2, Upload, X, XCircle, type LucideIcon } from "lucide-react";
import { DOC_MIME_TYPES, formatBytes, type FileUploadState, type UploadLimits } from "@/lib/doc-intel";

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  limits: UploadLimits;
  disabled?: boolean;
  /** Per-file upload progress, shown on each row (files without an entry show no status). */
  fileStates?: ReadonlyMap<File, FileUploadState>;
};

const STATE_VIEW: Record<FileUploadState["status"], { icon: LucideIcon; label: string; tone: string; spin?: boolean }> = {
  waiting: { icon: Clock, label: "Waiting", tone: "text-muted-foreground" },
  uploading: { icon: Loader2, label: "Uploading…", tone: "text-primary", spin: true },
  accepted: { icon: CheckCircle2, label: "Accepted", tone: "text-emerald-700" },
  rejected: { icon: XCircle, label: "Rejected", tone: "text-red-700" },
  failed: { icon: XCircle, label: "Upload failed", tone: "text-red-700" },
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
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          disabled
            ? "cursor-not-allowed border-border bg-muted/40 opacity-60"
            : dragActive
              ? "border-primary bg-primary/10"
              : "border-border bg-muted/40 hover:border-primary/50 hover:bg-primary/5"
        }`}
      >
        <Upload aria-hidden="true" className="h-6 w-6 text-primary" />
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
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p className="font-medium">Some files were not added:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 break-words">
            {problems.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {files.length} {files.length === 1 ? "file" : "files"} · {formatBytes(totalBytes)}
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={disabled}
              className="rounded text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              Remove all
            </button>
          </div>
          <ul aria-label="Selected files" className="divide-y divide-border rounded-lg border border-border">
            {files.map((file) => {
              const state = fileStates?.get(file);
              const view = state ? STATE_VIEW[state.status] : null;
              const Icon = view ? view.icon : FileText;
              return (
                <li key={fileKey(file)} className="flex items-start gap-3 px-3 py-2 text-sm">
                  <Icon
                    aria-hidden="true"
                    className={`mt-0.5 h-4 w-4 shrink-0 ${view ? view.tone : "text-muted-foreground"} ${view?.spin ? "animate-spin" : ""}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-foreground" title={file.name}>
                      {file.name}
                    </p>
                    {state && view && (
                      <p className={`break-words text-xs ${view.tone}`}>
                        {view.label}
                        {"reason" in state ? `: ${state.reason}` : ""}
                      </p>
                    )}
                  </div>
                  <span className="mt-0.5 shrink-0 text-xs tabular-nums text-muted-foreground">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(file)}
                    disabled={disabled}
                    aria-label={`Remove ${file.name}`}
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
