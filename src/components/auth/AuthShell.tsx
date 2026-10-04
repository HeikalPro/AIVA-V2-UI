import { useEffect, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { IconButton } from "@/components/ui/icon-button";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

/** Centred card for sign-in, sign-up, verification and password screens. */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  const { theme, toggleTheme } = useTheme();
  useEffect(() => {
    document.title = `${title} · AIVA`;
  }, [title]);
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <IconButton
        label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        icon={theme === "dark" ? Sun : Moon}
        onClick={toggleTheme}
        tooltipSide="left"
        className="absolute right-4 top-4"
      />

      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex items-center gap-2.5">
            {/* Light tile keeps the blue mark legible in dark mode. */}
            <span className="theme-light inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface">
              <img src="/GoChat247_blue_transparent.png" alt="GoChat247" className="h-9 w-9 object-contain" />
            </span>
            <span className="text-xl font-semibold tracking-tight text-foreground">AIVA</span>
          </div>
          <p className="mt-2 text-ui text-muted-foreground">AI Virtual Assistant for Call Centers</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-xs sm:p-8">
          <div className="mb-6 space-y-1">
            <h1 className="text-xl font-semibold leading-7 text-foreground">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-subtle-foreground">GoChat247 · AIVA</p>
      </div>
    </div>
  );
}

/** Text link styled for auth screens ("Forgot password?", "Sign up"). */
export const authLinkClass =
  "font-medium text-primary underline-offset-4 hover:text-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";
