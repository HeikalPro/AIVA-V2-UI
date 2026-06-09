import { Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function formatRenewalDate(iso: string | null | undefined): string {
  const value = toDateInputValue(iso);
  if (!value) return "Not set";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type ApiKeyRenewalCardProps = {
  accountName: string;
  renewalDate: string | null | undefined;
  editable?: boolean;
  draftDate?: string;
  onDraftDateChange?: (value: string) => void;
  onSave?: () => void;
  onClear?: () => void;
  saving?: boolean;
  error?: string | null;
  successMessage?: string | null;
};

export function ApiKeyRenewalCard({
  accountName,
  renewalDate,
  editable = false,
  draftDate = "",
  onDraftDateChange,
  onSave,
  onClear,
  saving = false,
  error,
  successMessage,
}: ApiKeyRenewalCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-indigo-600" />
          API Key Renewal Date
        </CardTitle>
        <CardDescription>Renewal date for account: {accountName}</CardDescription>
      </CardHeader>
      <CardContent>
        {editable ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="api-key-renewal-date">Renewal date</Label>
              <Input
                id="api-key-renewal-date"
                type="date"
                value={draftDate}
                onChange={(e) => onDraftDateChange?.(e.target.value)}
                className="mt-1 w-48"
              />
            </div>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            {draftDate ? (
              <Button type="button" variant="outline" onClick={onClear} disabled={saving}>
                Clear
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-lg font-semibold text-foreground">{formatRenewalDate(renewalDate)}</p>
        )}
        {successMessage && <p className="mt-2 text-sm text-emerald-600">{successMessage}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
