import { useEffect, useState } from "react";
import { formatUserError } from "@/lib/errors";
import { buildLoginEmail } from "@/lib/login-email";
import { LoginEmailField } from "@/components/auth/LoginEmailField";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Account } from "@/types/api";
import { useCreateTrainee } from "@/hooks/useAgents";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  defaultAccountId?: string;
};

export function TraineeDialog({ open, onOpenChange, accounts, defaultAccountId = "" }: Props) {
  const createTrainee = useCreateTrainee();
  const [form, setForm] = useState({
    emailLocal: "",
    password: "",
    first_name: "",
    last_name: "",
    account_id: defaultAccountId,
    status: "ACTIVE",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      emailLocal: "",
      password: "",
      first_name: "",
      last_name: "",
      account_id: defaultAccountId || String(accounts[0]?.id ?? ""),
      status: "ACTIVE",
    });
    setError(null);
  }, [open, defaultAccountId, accounts]);

  async function handleSave() {
    setError(null);
    const email = buildLoginEmail(form.emailLocal).toLowerCase();
    if (!email) {
      setError("Email is required.");
      return;
    }
    if (!form.password) {
      setError("Password is required.");
      return;
    }
    const accountId = Number(form.account_id);
    if (!accountId) {
      setError("Select an account for this trainee.");
      return;
    }
    try {
      await createTrainee.mutateAsync({
        email,
        password: form.password,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        account_id: accountId,
        status: form.status,
      });
      onOpenChange(false);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Trainee</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Creates an agent account with a <span className="font-medium">@gochat247.com</span> email assigned to the selected account.
          </p>
          <LoginEmailField
            localPart={form.emailLocal}
            onLocalPartChange={(emailLocal) => setForm({ ...form, emailLocal })}
          />
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First Name</Label>
              <Input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label>Account</Label>
            <Select
              value={form.account_id}
              onChange={(e) => setForm({ ...form, account_id: e.target.value })}
              className="mt-1"
            >
              {accounts.length === 0 ? (
                <option value="">No accounts available</option>
              ) : (
                accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))
              )}
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="mt-1"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </Select>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={createTrainee.isPending || accounts.length === 0}>
            {createTrainee.isPending ? "Creating…" : "Create Trainee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
