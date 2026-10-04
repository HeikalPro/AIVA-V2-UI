import { Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { KB_STAGES, STAGE_STATUS_LABELS, type StageDef } from "@/lib/doc-intel";
import { Tooltip } from "@/components/ui/tooltip";
import type { StageStatus } from "@/types/api";

/*
 * The one processing-pipeline component (Document Import: Upload · Extract · Chunk · Embed ·
 * Publish; SharePoint files: Download · Extract · Intelligence · Entities · Save). Steps are small
 * markers joined by connectors:
 *   completed = filled green ✓ · running = amber ring with a pulsing core · failed = filled red ✕
 *   waiting = hollow · skipped = dashed with a dash.
 * Every step has a text equivalent (tooltip + screen-reader text), so state is never colour-only.
 */

/** What the pipeline needs from a stage: knowledge-import stages and SharePoint-file stages both fit. */
export type PipelineStage = { name: string; status: StageStatus; error?: string | null };

/** Tone of a stage status, for text that accompanies the markers. */
export const STAGE_TEXT_CLASS: Record<StageStatus, string> = {
  PENDING: "text-muted-foreground",
  RUNNING: "text-warning",
  COMPLETED: "text-success",
  FAILED: "text-danger",
  SKIPPED: "text-muted-foreground",
};

/** A single step marker (16px, or 20px with size="md"). */
export function StageMarker({ status, size = "sm", className }: { status: StageStatus; size?: "sm" | "md"; className?: string }) {
  const box = size === "md" ? "h-5 w-5" : "h-4 w-4";
  const icon = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";
  switch (status) {
    case "COMPLETED":
      return (
        <span aria-hidden="true" className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full bg-success text-success-foreground", box, className)}>
          <Check strokeWidth={3.5} className={icon} />
        </span>
      );
    case "FAILED":
      return (
        <span aria-hidden="true" className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full bg-danger text-danger-foreground", box, className)}>
          <X strokeWidth={3.5} className={icon} />
        </span>
      );
    case "RUNNING":
      return (
        <span aria-hidden="true" className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full border-2 border-warning bg-surface", box, className)}>
          <span className="absolute inset-[3px] rounded-full bg-warning opacity-60 motion-safe:animate-ping" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-warning" />
        </span>
      );
    case "SKIPPED":
      return (
        <span aria-hidden="true" className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-input bg-surface text-muted-foreground", box, className)}>
          <Minus strokeWidth={3} className={icon} />
        </span>
      );
    default:
      return <span aria-hidden="true" className={cn("relative inline-flex shrink-0 rounded-full border border-input bg-surface", box, className)} />;
  }
}

/** @deprecated kept for older imports: same as <StageMarker />. */
export function StageStatusIcon({ status, className }: { status: StageStatus; className?: string }) {
  return <StageMarker status={status} className={className} />;
}

type Props = {
  stages: PipelineStage[];
  /** The stages to show, in pipeline order (default: the five knowledge-import stages). */
  stageDefs?: readonly StageDef[];
  /** Document-level error, used when the failed stage carries no message of its own. */
  fallbackError?: string | null;
  /** Show the failure reason under the steps (default true). */
  showReason?: boolean;
  /** compact = markers only, labels in tooltips (tables); labeled = markers with step names (details). */
  variant?: "compact" | "labeled";
  className?: string;
};

function stageError(stage: PipelineStage, fallbackError: string | null | undefined): string {
  return stage.error?.trim() || fallbackError?.trim() || "No reason was recorded.";
}

function connectorDone(status: StageStatus) {
  return status === "COMPLETED" || status === "SKIPPED";
}

export function StagePipeline({
  stages,
  stageDefs = KB_STAGES,
  fallbackError,
  showReason = true,
  variant = "compact",
  className,
}: Props) {
  // A stage missing from the payload is shown as waiting.
  const ordered = stageDefs.map((def) => ({
    def,
    stage: stages.find((s) => s.name === def.name) ?? { name: def.name, status: "PENDING" as const },
  }));
  const failed = ordered.find(({ stage }) => stage.status === "FAILED");
  const reason = failed ? stageError(failed.stage, fallbackError) : null;
  const describe = (def: StageDef, stage: PipelineStage) => {
    const statusText = STAGE_STATUS_LABELS[stage.status] ?? stage.status;
    return stage.status === "FAILED" ? `${def.label}: failed — ${stageError(stage, fallbackError)}` : `${def.label}: ${statusText.toLowerCase()}`;
  };

  const reasonLine =
    showReason && failed && reason ? (
      <p
        className={cn("break-words text-xs text-danger", variant === "compact" ? "mt-1 line-clamp-1 max-w-[18rem]" : "mt-3 line-clamp-3")}
        title={reason}
      >
        <span className="font-medium">{failed.def.label} failed:</span> {reason}
      </p>
    ) : null;

  if (variant === "labeled") {
    return (
      <div className={className}>
        <ol
          aria-label="Processing stages"
          className="grid"
          style={{ gridTemplateColumns: `repeat(${ordered.length}, minmax(0, 1fr))` }}
        >
          {ordered.map(({ def, stage }, i) => {
            const prev = i > 0 ? ordered[i - 1].stage.status : null;
            const statusText = STAGE_STATUS_LABELS[stage.status] ?? stage.status;
            return (
              <li key={def.name} className="relative flex min-w-0 flex-col items-center gap-1 px-1 text-center" title={describe(def, stage)}>
                {prev != null && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute right-[calc(50%+14px)] top-2.5 h-0.5 w-[calc(100%-28px)] -translate-y-1/2 rounded-full",
                      connectorDone(prev) ? "bg-success" : "bg-border",
                    )}
                  />
                )}
                <StageMarker status={stage.status} size="md" />
                <span className="max-w-full truncate text-xs font-medium text-foreground">{def.label}</span>
                <span className={cn("text-xs", STAGE_TEXT_CLASS[stage.status])}>{statusText}</span>
              </li>
            );
          })}
        </ol>
        {reasonLine}
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      <ol aria-label="Processing stages" className="inline-flex items-center">
        {ordered.map(({ def, stage }, i) => {
          const prev = i > 0 ? ordered[i - 1].stage.status : null;
          const description = describe(def, stage);
          return (
            <li key={def.name} className="inline-flex items-center">
              {prev != null && (
                <span aria-hidden="true" className={cn("h-0.5 w-2.5", connectorDone(prev) ? "bg-success" : "bg-border")} />
              )}
              <Tooltip content={description}>
                <span className="inline-flex">
                  <StageMarker status={stage.status} />
                  <span className="sr-only">{description}</span>
                </span>
              </Tooltip>
            </li>
          );
        })}
      </ol>
      {reasonLine}
    </div>
  );
}
