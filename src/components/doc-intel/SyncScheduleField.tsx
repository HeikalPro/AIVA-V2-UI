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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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
  const chip = (on: boolean) =>
    `inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${
      on
        ? "border-primary bg-primary/10 text-primary"
        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
    }`;

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={value.enabled}
          disabled={disabled}
          onChange={(e) => set({ enabled: e.target.checked })}
          aria-describedby={`${id}-preview`}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-primary"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-700">Automatic sync</span>
          <span className="block text-xs text-muted-foreground">
            Check the folder on a schedule. Sync now works either way.
          </span>
        </span>
      </label>

      {value.enabled && (
        <div className="space-y-4 border-l-2 border-border pl-4">
          <div role="group" aria-labelledby={`${id}-interval`} className="space-y-2">
            <span id={`${id}-interval`} className="block text-sm font-medium text-slate-700">
              Repeat
            </span>
            <div className="flex flex-wrap gap-2">
              {SYNC_INTERVAL_PRESETS.map((days) => (
                <button
                  key={days}
                  type="button"
                  aria-pressed={value.interval === days}
                  disabled={disabled}
                  onClick={() => set({ interval: days, customDays: String(days) })}
                  className={chip(value.interval === days)}
                >
                  {presetLabel(days)}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={value.interval === "custom"}
                disabled={disabled}
                onClick={() => set({ interval: "custom" })}
                className={chip(value.interval === "custom")}
              >
                Custom (days)
              </button>
            </div>
            {value.interval === "custom" && (
              <div>
                <div className="flex items-center gap-2">
                  <label htmlFor={`${id}-days`} className="text-sm text-slate-700">
                    Every
                  </label>
                  <div className="w-24">
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
                    />
                  </div>
                  <span className="text-sm text-slate-700">days</span>
                </div>
                {intervalError && (
                  <p id={`${id}-days-error`} className="mt-1 text-xs text-red-600">
                    {intervalError}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor={`${id}-hour`} className="block text-sm font-medium text-slate-700">
              Time of day
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <div className="w-28">
                <Select
                  id={`${id}-hour`}
                  value={String(value.hour)}
                  disabled={disabled}
                  onChange={(e) => set({ hour: Number(e.target.value) })}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </Select>
              </div>
              <span className="text-xs text-muted-foreground">{SCHEDULE_TIME_ZONE_LABEL}</span>
            </div>
          </div>
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
            <p className="text-amber-700">
              Automatic syncs are off on this server (DOC_INTEL_SCHEDULER_ENABLED=false), so this schedule won't run until
              they are turned on.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
