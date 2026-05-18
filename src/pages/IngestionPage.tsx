import { useState } from "react";
import { Play, Plus, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import {
  useIngestionRequests,
  useCreateIngestionRequest,
  useTriggerIngestion,
  useJobStatus,
} from "@/hooks/useIngestion";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { IngestionRequest } from "@/types/api";

export function IngestionPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const canTrigger = user?.roles.some((r) => r === ROLES.SUPER_ADMIN || r === ROLES.DEVELOPER);
  const { data: accounts = [] } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const { data = [], isLoading } = useIngestionRequests();
  const createRequest = useCreateIngestionRequest();
  const triggerIngestion = useTriggerIngestion();

  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const { data: jobStatus } = useJobStatus(jobId);

  const [requestForm, setRequestForm] = useState({ account_id: "", request_type: "DOCUMENT", priority: "MEDIUM", description: "" });
  const [triggerForm, setTriggerForm] = useState({ corpus_id: "", lines: "", reindex: false });
  const [error, setError] = useState<string | null>(null);

  async function handleCreateRequest() {
    setError(null);
    try {
      await createRequest.mutateAsync({
        account_id: Number(requestForm.account_id),
        request_type: requestForm.request_type,
        priority: requestForm.priority,
        description: requestForm.description,
      });
      setRequestDialogOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleTrigger() {
    setError(null);
    try {
      const lines = triggerForm.lines.split("\n").map((l) => l.trim()).filter(Boolean);
      const result = await triggerIngestion.mutateAsync({
        corpus_id: triggerForm.corpus_id,
        lines,
        reindex: triggerForm.reindex,
      });
      setJobId(result.job_id);
      setTriggerDialogOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Upload}
        title="Ingestion"
        description="Knowledge base ingestion requests and jobs"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => { setError(null); setRequestDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> New Request
            </Button>
            {canTrigger && (
              <Button variant="outline" onClick={() => { setError(null); setTriggerDialogOpen(true); }}>
                <Play className="mr-2 h-4 w-4" /> Trigger Job
              </Button>
            )}
          </div>
        }
      />

      {jobId && jobStatus && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Job {jobId}</p>
          <p className="text-sm text-muted-foreground">Status: {jobStatus.status ?? "—"}</p>
          {jobStatus.error_msg && <p className="text-sm text-red-600">{jobStatus.error_msg}</p>}
        </div>
      )}

      <DataTable<IngestionRequest>
        columns={[
          { key: "id", header: "ID", sortable: true },
          { key: "account_id", header: "Account", sortable: true },
          { key: "request_type", header: "Type", render: (r) => r.request_type ?? "—" },
          { key: "priority", header: "Priority", sortable: true },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "description", header: "Description", render: (r) => (r.description ?? "").slice(0, 60) },
        ]}
        data={data}
        keyFn={(r) => r.id}
        loading={isLoading}
      />

      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Ingestion Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Account</Label>
              <Select value={requestForm.account_id} onChange={(e) => setRequestForm({ ...requestForm, account_id: e.target.value })} className="mt-1">
                <option value="">Select account</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>
            <div><Label>Request Type</Label><Input value={requestForm.request_type} onChange={(e) => setRequestForm({ ...requestForm, request_type: e.target.value })} className="mt-1" /></div>
            <div>
              <Label>Priority</Label>
              <Select value={requestForm.priority} onChange={(e) => setRequestForm({ ...requestForm, priority: e.target.value })} className="mt-1">
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <textarea value={requestForm.description} onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })} rows={3} className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRequest}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={triggerDialogOpen} onOpenChange={setTriggerDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Trigger Ingestion Job</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Corpus ID</Label><Input value={triggerForm.corpus_id} onChange={(e) => setTriggerForm({ ...triggerForm, corpus_id: e.target.value })} className="mt-1" /></div>
            <div>
              <Label>Lines (one per line)</Label>
              <textarea value={triggerForm.lines} onChange={(e) => setTriggerForm({ ...triggerForm, lines: e.target.value })} rows={8} className="mt-1 w-full rounded-md border border-input px-3 py-2 font-mono text-sm" placeholder="Line 1&#10;Line 2" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={triggerForm.reindex} onChange={(e) => setTriggerForm({ ...triggerForm, reindex: e.target.checked })} />
              Reindex
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTriggerDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleTrigger} disabled={triggerIngestion.isPending}>Run</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
