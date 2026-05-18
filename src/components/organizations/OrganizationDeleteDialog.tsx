import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (open) setAcknowledged(false);
  }, [open, organization?.id]);

  const orgLabel = organization
    ? `${organization.name} (${organization.code})`
    : "this organization";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !deleting && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            Confirm permanent deletion
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm text-slate-700">
          <p>
            You are about to permanently delete <strong>{orgLabel}</strong> and all data
            associated with it. This action cannot be undone.
          </p>

          {loadingSummary && (
            <p className="text-muted-foreground">Loading impact summary…</p>
          )}

          {summaryError && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              Could not load full preview from server. Counts below are from the current list.
            </p>
          )}

          {summary && !loadingSummary && (
            <div className="rounded-lg border border-red-200 bg-red-50/60 px-4 py-3 space-y-2">
              <p className="font-medium text-red-900">The following will be removed:</p>
              <ul className="list-disc space-y-1 pl-5 text-red-900">
                <li>
                  <strong>{summary.user_count}</strong> user
                  {summary.user_count === 1 ? "" : "s"}
                </li>
                <li>
                  <strong>{summary.account_count}</strong> account
                  {summary.account_count === 1 ? "" : "s"}
                  {summary.account_names.length > 0 && (
                    <span className="text-red-800">
                      {" "}
                      ({summary.account_names.join(", ")})
                    </span>
                  )}
                </li>
                {summary.ticket_count > 0 && (
                  <li>
                    <strong>{summary.ticket_count}</strong> ticket
                    {summary.ticket_count === 1 ? "" : "s"}
                  </li>
                )}
                {summary.ticket_count === 0 && (
                  <li>All tickets and related records for this organization</li>
                )}
                <li>All chat sessions, messages, prompts, and ingestion records for those accounts</li>
              </ul>
            </div>
          )}

          {deleteError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              {deleteError}
            </p>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={deleting || loadingSummary}
            />
            <span>
              I understand that this will permanently delete the organization, its accounts,
              users, tickets, and related records. This action is irreversible.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!acknowledged || deleting || loadingSummary || !summary}
          >
            {deleting ? "Deleting…" : "Delete organization"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
