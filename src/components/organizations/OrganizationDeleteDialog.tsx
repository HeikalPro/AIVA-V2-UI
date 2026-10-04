import { useEffect, useId, useState } from "react";
import { formatNumber } from "@/lib/format";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { SkeletonText } from "@/components/ui/skeleton";
import type { Organization, OrganizationDeleteSummary } from "@/types/api";

type OrganizationDeleteDialogProps = {
  open: boolean;
  organization: Organization | null;
  summary: OrganizationDeleteSummary | null;
  loadingSummary: boolean;
  summaryError: string | null;
  deleting: boolean;
  deleteError: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

function plural(count: number, noun: string) {
  return `${formatNumber(count)} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Permanent organization deletion: shows the impact summary and requires an explicit
 * acknowledgement before the destructive button is enabled.
 */
export function OrganizationDeleteDialog({
  open,
  organization,
  summary,
  loadingSummary,
  summaryError,
  deleting,
  deleteError,
  onCancel,
  onConfirm,
}: OrganizationDeleteDialogProps) {
  const ackId = useId();
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (open) setAcknowledged(false);
  }, [open, organization?.id]);

  return (
    <ConfirmDialog
      open={open}
      title="Delete organization permanently?"
      description={
        organization ? (
          <>
            <bdi className="font-medium text-foreground">{organization.name}</bdi>{" "}
            <span className="font-mono text-xs">({organization.code})</span> and all data associated with it are
            deleted. This can&apos;t be undone.
          </>
        ) : (
          "This organization and all data associated with it are deleted. This can't be undone."
        )
      }
      destructive
      confirmLabel="Delete organization"
      loading={deleting}
      loadingLabel="Deleting…"
      confirmDisabled={!acknowledged || loadingSummary || !summary}
      error={deleteError}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {loadingSummary && (
        <div aria-busy="true" aria-label="Loading impact summary" className="rounded-lg border border-border p-3">
          <SkeletonText lines={3} />
        </div>
      )}

      {summaryError && (
        <Alert tone="warning">Couldn&apos;t load the full preview from the server. Counts below are from the current list.</Alert>
      )}

      {summary && !loadingSummary && (
        <div className="rounded-lg border border-danger/25 bg-danger-muted px-3 py-2.5">
          <p className="font-medium text-foreground">This removes:</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-foreground/85 marker:text-danger">
            <li>{plural(summary.user_count, "user")}</li>
            <li>
              {plural(summary.account_count, "account")}
              {summary.account_names.length > 0 && (
                <>
                  {" "}
                  (<bdi>{summary.account_names.join(", ")}</bdi>)
                </>
              )}
            </li>
            {summary.ticket_count > 0 ? (
              <li>{plural(summary.ticket_count, "ticket")}</li>
            ) : (
              <li>All tickets and related records for this organization</li>
            )}
            <li>All chat sessions, messages, prompts and ingestion records for those accounts</li>
          </ul>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-muted px-3 py-2.5">
        <Checkbox
          id={ackId}
          className="mt-0.5"
          checked={acknowledged}
          onCheckedChange={(v) => setAcknowledged(v === true)}
          disabled={deleting || loadingSummary}
        />
        <label htmlFor={ackId} className="cursor-pointer text-sm text-foreground">
          I understand this permanently deletes the organization, its accounts, users, tickets and related records.
        </label>
      </div>
    </ConfirmDialog>
  );
}
