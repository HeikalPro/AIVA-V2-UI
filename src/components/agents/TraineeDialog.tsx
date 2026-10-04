import { useEffect, useState, type FormEvent } from "react";
import { formatUserError } from "@/lib/errors";
import { buildLoginEmail, LOGIN_EMAIL_DOMAIN } from "@/lib/login-email";
import { passwordHint } from "@/lib/password-hint";
import { LoginEmailField } from "@/components/auth/LoginEmailField";
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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FieldGroup } from "@/components/ui/field";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { toast } from "@/components/ui/toast";
import type { Account } from "@/types/api";
import { useCreateTrainee } from "@/hooks/useAgents";
import { useReturnFocus } from "@/components/users/useReturnFocus";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  defaultAccountId?: string;
};

export function TraineeDialog({ open, onOpenChange, accounts, defaultAccountId = "" }: Props) {
  const createTrainee = useCreateTrainee();
  const returnFocus = useReturnFocus();
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
      toast.success("Trainee created", { description: email });
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (createTrainee.isPending || accounts.length === 0) return;
    void handleSave();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="md">
      <DialogContent onCloseAutoFocus={returnFocus}>
        <form onSubmit={onSubmit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>Add trainee</DialogTitle>
            <DialogDescription>
              Creates an agent login with an @{LOGIN_EMAIL_DOMAIN} email, assigned to the selected account.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <ErrorAlert message={error} />
            <LoginEmailField
              localPart={form.emailLocal}
              onLocalPartChange={(emailLocal) => setForm({ ...form, emailLocal })}
            />
            <Field label="Password" hint={passwordHint()} required>
              <Input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <FieldGroup>
              <Field label="First name">
                <Input
                  dir="auto"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
              </Field>
              <Field label="Last name">
                <Input
                  dir="auto"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field label="Account" required>
                <Select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
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
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </Field>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createTrainee.isPending} disabled={accounts.length === 0}>
              {createTrainee.isPending ? "Creating…" : "Create trainee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
