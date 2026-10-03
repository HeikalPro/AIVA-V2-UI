import { CheckCircle2, Circle, Loader2, MinusCircle, XCircle, type LucideIcon } from "lucide-react";
import { KB_STAGES, STAGE_STATUS_LABELS, type StageDef } from "@/lib/doc-intel";
import type { StageStatus } from "@/types/api";

/** Icon and colours per stage status (theme tokens / dark-remapped shades only). */
export const STAGE_STATUS_STYLE: Record<StageStatus, { icon: LucideIcon; pill: string; text: string; spin?: boolean }> = {
  PENDING: { icon: Circle, pill: "border-border bg-muted text-muted-foreground", text: "text-muted-foreground" },
  RUNNING: { icon: Loader2, pill: "border-primary/30 bg-primary/10 text-primary", text: "text-primary", spin: true },
  COMPLETED: { icon: CheckCircle2, pill: "border-emerald-200 bg-emerald-50 text-emerald-700", text: "text-emerald-700" },
  FAILED: { icon: XCircle, pill: "border-red-200 bg-red-50 text-red-700", text: "text-red-700" },
  SKIPPED: { icon: MinusCircle, pill: "border-dashed border-border text-muted-foreground", text: "text-muted-foreground" },
};

export function StageStatusIcon({ status, className = "h-3.5 w-3.5" }: { status: StageStatus; className?: string }) {
  const style = STAGE_STATUS_STYLE[status] ?? STAGE_STATUS_STYLE.PENDING;
  const Icon = style.icon;
  return <Icon aria-hidden="true" className={`shrink-0 ${style.spin ? "animate-spin" : ""} ${className}`} />;
}

/** What the pills need from a stage: knowledge-import stages and SharePoint-file stages both fit. */
export type PipelineStage = { name: string; status: StageStatus; error?: string | null };

type Props = {
  stages: PipelineStage[];
  /** The stages to show, in pipeline order (default: the five knowledge-import stages). */
  stageDefs?: readonly StageDef[];
  /** Document-level error, used when the failed stage carries no message of its own. */
  fallbackError?: string | null;
  /** Show the failure reason under the pills (default true). */
  showReason?: boolean;
  className?: string;
};

function stageError(stage: PipelineStage, fallbackError: string | null | undefined): string {
  return stage.error?.trim() || fallbackError?.trim() || "No reason was recorded.";
}

/** The pipeline stages as compact pills, in order, with the failure reason underneath. */
export function StagePipeline({ stages, stageDefs = KB_STAGES, fallbackError, showReason = true, className = "" }: Props) {
  // A stage missing from the payload is shown as waiting.
  const ordered = stageDefs.map((def) => ({
    def,
    stage: stages.find((s) => s.name === def.name) ?? { name: def.name, status: "PENDING" as const },
  }));
  const failed = ordered.find(({ stage }) => stage.status === "FAILED");
  const reason = failed ? stageError(failed.stage, fallbackError) : null;

  return (
    <div className={className}>
      <ol aria-label="Processing stages" className="flex flex-wrap items-center gap-1">
        {ordered.map(({ def, stage }) => {
          const style = STAGE_STATUS_STYLE[stage.status] ?? STAGE_STATUS_STYLE.PENDING;
          const statusText = STAGE_STATUS_LABELS[stage.status] ?? stage.status;
          const description =
            stage.status === "FAILED"
              ? `${def.label}: failed — ${stageError(stage, fallbackError)}`
              : `${def.label}: ${statusText.toLowerCase()}`;
          return (
            <li
              key={def.name}
              aria-label={description}
              title={description}
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${style.pill}`}
            >
              <StageStatusIcon status={stage.status} />
              <span>{def.short}</span>
            </li>
          );
        })}
      </ol>
      {showReason && failed && reason && (
        <p className="mt-1.5 line-clamp-2 max-w-md break-words text-xs text-red-700" title={reason}>
          <span className="font-semibold">{failed.def.label} failed:</span> {reason}
        </p>
      )}
    </div>
  );
}
