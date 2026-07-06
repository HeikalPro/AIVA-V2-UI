import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QueueSelector } from "@/components/chat/QueueSelector";
import { useAgentQueueAccess, useUpdateAgentQueueAccess } from "@/hooks/useKbQueues";
import { formatUserError } from "@/lib/errors";
import type { User } from "@/types/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: User | null;
  accountId: number | null;
};

export function AgentQueueAccessDialog({ open, onOpenChange, agent, accountId }: Props) {
  const userId = agent?.id ?? null;
  const { data, isLoading } = useAgentQueueAccess(accountId, userId);
  const updateAccess = useUpdateAgentQueueAccess();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const initial =
      data.assigned_queues.length > 0 ? data.assigned_queues : data.allowed_queues;
    setSelected(initial);
  }, [data, agent?.id]);

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
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  const name = agent
    ? [agent.first_name, agent.last_name].filter(Boolean).join(" ") || agent.email
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>KB queue access</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose which knowledge-base queues {name} can use on the widget and in chat.
          </p>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {data && (
          <QueueSelector
            queues={data.available_queues}
            selected={selected}
            onChange={setSelected}
            disabled={updateAccess.isPending}
          />
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={updateAccess.isPending || !selected.length}>
            {updateAccess.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
