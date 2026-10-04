import { useEffect, useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { QueueSelector } from "@/components/chat/QueueSelector";
import { useAgentQueueAccess, useUpdateAgentQueueAccess } from "@/hooks/useKbQueues";
import { formatUserError } from "@/lib/errors";
import type { User } from "@/types/api";
import { useReturnFocus } from "@/components/users/useReturnFocus";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: User | null;
  accountId: number | null;
};

export function AgentQueueAccessDialog({ open, onOpenChange, agent, accountId }: Props) {
  const userId = agent?.id ?? null;
  const { data, isLoading, isError, error: loadError } = useAgentQueueAccess(accountId, userId);
  const updateAccess = useUpdateAgentQueueAccess();
  const returnFocus = useReturnFocus();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const initial =
      data.assigned_queues.length > 0 ? data.assigned_queues : data.allowed_queues;
    setSelected(initial);
  }, [data, agent?.id]);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const name = agent
    ? [agent.first_name, agent.last_name].filter(Boolean).join(" ") || agent.email
    : "";

  async function handleSave() {
    if (!agent || accountId == null || selected.length === 0) return;
    setError(null);
    try {
      await updateAccess.mutateAsync({
        userId: agent.id,
        accountId,
        queueKeys: selected,
      });
      onOpenChange(false);
      toast.success("Queue access updated", { description: name });
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="md">
      <DialogContent onCloseAutoFocus={returnFocus}>
        <DialogHeader>
          <DialogTitle>Edit queue access</DialogTitle>
          <DialogDescription>
            Choose which knowledge-base queues <bdi className="font-medium text-foreground">{name}</bdi> can use in the
            widget and in chat.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <ErrorAlert message={error} />
          {isLoading && (
            <div className="space-y-2" aria-busy="true" aria-label="Loading queues">
              <Skeleton className="h-4 w-24" />
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-8 w-24 rounded-full" />
                ))}
              </div>
            </div>
          )}
          {isError && <ErrorAlert message={formatUserError(loadError)} />}
          {data &&
            (data.available_queues.length > 0 ? (
              <>
                <QueueSelector
                  queues={data.available_queues}
                  selected={selected}
                  onChange={setSelected}
                  disabled={updateAccess.isPending}
                />
                <p className="text-xs text-muted-foreground">At least one queue must stay selected.</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">This account has no knowledge-base queues yet.</p>
            ))}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={!selected.length} loading={updateAccess.isPending}>
            {updateAccess.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
