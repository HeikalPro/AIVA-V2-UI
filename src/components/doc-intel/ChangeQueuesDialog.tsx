import { useMemo, useState } from "react";
import { useAccountKbQueues } from "@/hooks/useAccounts";
import { useChangeKbDocumentQueues } from "@/hooks/useDocumentImport";
import { formatUserError } from "@/lib/errors";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Alert } from "@/components/ui/alert";
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
import { toast } from "@/components/ui/toast";
import { QueueMultiSelect } from "@/components/doc-intel/QueueMultiSelect";
import type { KbDocumentOut } from "@/types/api";

type Props = {
  document: KbDocumentOut;
  onClose: () => void;
};

function sameKeys(a: string[], b: string[]): boolean {
  return [...a].sort().join("\u0000") === [...b].sort().join("\u0000");
}

/** Edit which queues a document is published to. Config-only on the server: nothing is re-embedded. */
export function ChangeQueuesDialog({ document: doc, onClose }: Props) {
  const catalog = useAccountKbQueues(doc.account_id);
  const change = useChangeKbDocumentQueues();
  const [selected, setSelected] = useState<string[]>(doc.queue_keys);
  const [error, setError] = useState<string | null>(null);

  const queues = useMemo(() => catalog.data ?? [], [catalog.data]);
  const catalogKeys = useMemo(() => new Set(queues.map((q) => q.key)), [queues]);
  const catalogReady = catalog.isSuccess && queues.length > 0;

  // Queues the document is on that the knowledge base no longer offers. They can't be kept
  // (the server validates against the catalog), so saving drops them.
  const retired = catalogReady
    ? doc.queue_keys.map((key, i) => ({ key, label: doc.queue_labels[i] || key })).filter((q) => !catalogKeys.has(q.key))
    : [];
  const effective = catalogReady ? selected.filter((k) => catalogKeys.has(k)) : selected;
  const dirty = !sameKeys(effective, doc.queue_keys);
  const blocker =
    effective.length === 0
      ? "Select at least one queue. To take the document out of every queue, use Unpublish."
      : !dirty
        ? "No changes yet."
        : null;

  async function handleSave() {
    if (blocker || !catalogReady) return;
    setError(null);
    try {
      await change.mutateAsync({ id: doc.id, queueKeys: effective });
      toast.success("Queues updated", { description: doc.filename });
      onClose();
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !change.isPending && onClose()} size="md">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change queues</DialogTitle>
          <DialogDescription className="break-words">
            <bdi>{doc.filename}</bdi> · {doc.organization_name ? `${doc.organization_name} · ` : ""}
            {doc.account_name ?? `Account #${doc.account_id}`}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <QueueMultiSelect
            queues={queues}
            selected={effective}
            onChange={setSelected}
            loading={catalog.isLoading}
            error={catalog.isError ? formatUserError(catalog.error) : null}
            disabled={change.isPending}
          />
          {retired.length > 0 && (
            <Alert tone="warning">
              No longer offered by this knowledge base: {retired.map((q) => q.label).join(", ")}. Saving removes the document from{" "}
              {retired.length === 1 ? "it" : "them"}.
            </Alert>
          )}
          <p className="text-xs text-muted-foreground">Only the queue assignment changes: the document is not re-processed or re-embedded.</p>
          <ErrorAlert message={error} />
        </DialogBody>

        <DialogFooter>
          {catalogReady && blocker && <p className="mr-auto text-xs text-muted-foreground">{blocker}</p>}
          <Button variant="outline" onClick={onClose} disabled={change.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!catalogReady || blocker != null} loading={change.isPending}>
            {change.isPending ? "Saving…" : "Save queues"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
