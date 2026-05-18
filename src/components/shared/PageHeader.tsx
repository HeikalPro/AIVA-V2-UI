import type { ComponentType, ReactNode } from "react";

type PageHeaderProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ icon: Icon, title, description, actions }: PageHeaderProps) {
  return (
    <div className="relative overflow-visible rounded-2xl border border-border bg-gradient-to-r from-primary/8 to-transparent p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-sm">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
