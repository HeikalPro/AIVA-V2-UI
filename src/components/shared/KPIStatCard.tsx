import type { ReactNode } from "react";

export type KPIStatCardProps = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  iconColor?: string;
};

export function KPIStatCard({
  label,
  value,
  icon,
  iconColor = "bg-accent text-accent-foreground",
}: KPIStatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4">
      {icon ? (
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>{icon}</div>
      ) : null}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}
