import { useId } from "react";
import { CalendarClock } from "lucide-react";
import {
  MAX_SYNC_INTERVAL_DAYS,
  MIN_SYNC_INTERVAL_DAYS,
  SCHEDULE_TIME_ZONE_LABEL,
  SYNC_INTERVAL_PRESETS,
  formatScheduleTime,
  hourLabel,
  presetLabel,
  type ScheduleDraft,
} from "@/lib/sharepoint-sync";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleChip } from "@/components/widget-config/ToggleChip";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

type Props = {
  value: ScheduleDraft;
  onChange: (next: ScheduleDraft) => void;
  /** next_sync_at of the saved source (null for a new source or a schedule that is off). */
  nextSyncAt?: string | null;
  /** The draft differs from the saved schedule (always true for a new source). */
  changed: boolean;
  /** The custom interval is not a whole number of days in range (shown under the input). */
  intervalError?: string | null;
  /** DOC_INTEL_SCHEDULER_ENABLED on this server; automatic syncs never run when false. */
  schedulerEnabled?: boolean;
  disabled?: boolean;
};

/** Automatic sync toggle, interval (1–4 weeks or custom days), hour of day, and a next-run preview. */
export function SyncScheduleField({
  value,
  onChange,
  nextSyncAt,
  changed,
  intervalError,
  schedulerEnabled = true,
  disabled = false,
}: Props) {
  const id = useId();
  const set = (patch: Partial<ScheduleDraft>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <Field
        orientation="horizontal"
        label="Automatic sync"
        htmlFor={`${id}-enabled`}
        hint="Check the folder on a schedule. Sync now works either way."
      >
        <Switch
          id={`${id}-enabled`}
          checked={value.enabled}
          disabled={disabled}
          onCheckedChange={(on) => set({ enabled: on })}
          aria-describedby={`${id}-preview`}
        />
      </Field>

      {value.enabled && (
        <div className="space-y-4 rounded-lg border border-border bg-surface-muted px-4 py-3">
          <div role="group" aria-labelledby={`${id}-interval`} className="space-y-2">
            <Label id={`${id}-interval`}>Repeat</Label>
            <div className="flex flex-wrap gap-2">
              {SYNC_INTERVAL_PRESETS.map((days) => (
                <ToggleChip
                  key={days}
                  pressed={value.interval === days}
                  disabled={disabled}
                  onPressedChange={() => set({ interval: days, customDays: String(days) })}
                >
                  {presetLabel(days)}
                </ToggleChip>
              ))}
              <ToggleChip pressed={value.interval === "custom"} disabled={disabled} onPressedChange={() => set({ interval: "custom" })}>
                Custom (days)
              </ToggleChip>
            </div>
            {value.interval === "custom" && (
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`${id}-days`} className="font-normal">
                    Every
                  </Label>
                  <Input
                    id={`${id}-days`}
                    type="number"
                    inputMode="numeric"
                    min={MIN_SYNC_INTERVAL_DAYS}
                    max={MAX_SYNC_INTERVAL_DAYS}
                    step={1}
                    value={value.customDays}
                    disabled={disabled}
                    onChange={(e) => set({ customDays: e.target.value })}
                    aria-invalid={intervalError ? true : undefined}
                    aria-describedby={intervalError ? `${id}-days-error` : undefined}
                    className="w-24"
                  />
                  <span className="text-sm text-foreground">days</span>
                </div>
                {intervalError && (
                  <p id={`${id}-days-error`} className="mt-1 text-xs font-medium text-danger">
                    {intervalError}
                  </p>
                )}
              </div>
            )}
          </div>

          <Field label="Time of day" htmlFor={`${id}-hour`} hint={SCHEDULE_TIME_ZONE_LABEL}>
            <Select
              id={`${id}-hour`}
              value={String(value.hour)}
              disabled={disabled}
              onChange={(e) => set({ hour: Number(e.target.value) })}
              className="w-28"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      <div id={`${id}-preview`} className="flex items-start gap-2 text-xs text-muted-foreground">
        <CalendarClock aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p>
            {!value.enabled ? (
              "Automatic sync is off: the folder is checked only when you press Sync now."
            ) : !changed && nextSyncAt ? (
              <>
                Next automatic sync:{" "}
                <span className="font-medium text-foreground">
                  {formatScheduleTime(nextSyncAt)} ({SCHEDULE_TIME_ZONE_LABEL})
                </span>
              </>
            ) : (
              "The next automatic sync time is computed after you save."
            )}
          </p>
          {value.enabled && !schedulerEnabled && (
            <p className="text-warning">
              Automatic syncs are off on this server (DOC_INTEL_SCHEDULER_ENABLED=false), so this schedule won't run until they are
              turned on.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
