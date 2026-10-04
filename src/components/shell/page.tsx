import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Page frame + heading. The shell pads <main>; a page chooses its own content width.
 *
 *   <Page width="wide">
 *     <PageHeading
 *       title="Users"
 *       description="Manage users, permissions and account access."
 *       meta="423 users"
 *       actions={<Button><Plus className="h-4 w-4" />Add user</Button>}
 *     />
 *     …filters, content…
 *   </Page>
 */

export type PageWidth = "narrow" | "default" | "wide" | "full";

const WIDTH: Record<PageWidth, string> = {
  /** Forms and configuration (~896px). */
  narrow: "max-w-4xl",
  /** Most pages (1280px). */
  default: "max-w-[1280px]",
  /** Data tables, dashboard, monitoring (1600px). */
  wide: "max-w-[1600px]",
  /** Fluid: uses the whole workspace. */
  full: "max-w-none",
};

type PageProps = HTMLAttributes<HTMLDivElement> & {
  /** narrow ≈ 896px · default 1280px · wide 1600px · full = no max width. Centred. */
  width?: PageWidth;
  children?: ReactNode;
};

/** Centred page column with the standard vertical rhythm between sections. */
export function Page({ width = "default", className, children, ...props }: PageProps) {
  return (
    <div className={cn("mx-auto w-full min-w-0 space-y-5", WIDTH[width], className)} {...props}>
      {children}
    </div>
  );
}

type PageHeadingProps = {
  /** The page title (rendered as the page's only <h1>). */
  title: ReactNode;
  /** One short line under the title. */
  description?: ReactNode;
  /** Right-aligned actions (wrap below the title on narrow widths). */
  actions?: ReactNode;
  /** Small supporting info next to the title, e.g. "423 users" or a <Status />. */
  meta?: ReactNode;
  /** Extra content under the heading row (e.g. a notice or tabs that belong to the heading). */
  children?: ReactNode;
  className?: string;
};

/** Plain page heading: no card, no icon tile. */
export function PageHeading({ title, description, actions, meta, children, className }: PageHeadingProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-[1_1_320px]">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h1 className="min-w-0 text-2xl font-semibold leading-8 text-foreground [overflow-wrap:anywhere]">
              {title}
            </h1>
            {meta != null && meta !== false && (
              <div className="flex items-center gap-2 text-ui text-muted-foreground tabular-nums">{meta}</div>
            )}
          </div>
          {description != null && description !== false && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions != null && actions !== false && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {children}
    </div>
  );
}
