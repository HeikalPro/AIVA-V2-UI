import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-[420px]">
        <div className="rounded-3xl border border-slate-100 bg-white px-10 py-12 shadow-xl shadow-slate-200/60">
          <div className="mb-10 flex flex-col items-center">
            <img
              src="/GoChat247_blue_transparent.png"
              alt="GoChat247"
              className="mb-4 h-20 w-20 object-contain"
            />
            <h1 className="text-center text-2xl font-bold tracking-tight text-slate-800">{title}</h1>
            {subtitle ? (
              <p className="mt-2 text-center text-sm text-slate-400">{subtitle}</p>
            ) : null}
          </div>
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">GoChat247 · AIVA</p>
      </div>
    </div>
  );
}
