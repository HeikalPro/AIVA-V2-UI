import { CRM_STAGES } from "@/lib/sharepoint-sync";
import { StagePipeline } from "@/components/doc-intel/StagePipeline";
import type { CrmStageOut } from "@/types/api";

type Props = {
  stages: CrmStageOut[];
  /** File-level error, used when the failed stage carries no message of its own. */
  fallbackError?: string | null;
  showReason?: boolean;
  className?: string;
};

/**
 * A SharePoint file's five stages: download → extraction → CRM intelligence → entities → save to
 * CRM. Green = done, red = failed (reason inline), spinner = running, grey = waiting or skipped.
 */
export function CrmStagePipeline(props: Props) {
  return <StagePipeline {...props} stageDefs={CRM_STAGES} />;
}
