import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

type FieldProps = {
  label?: ReactNode;
  /** id of the control. When omitted, an id is generated and given to the single child control. */
  htmlFor?: string;
  /** Helper text under the control. */
  hint?: ReactNode;
  /** Error message. When set, the control gets aria-invalid and the message is announced via aria-describedby. */
  error?: ReactNode;
  /** Adds the label marker and aria-required (does NOT add native `required`; validation is unchanged). */
  required?: boolean;
  /** Content aligned to the right of the label (e.g. a "Reset" link). */
  labelAction?: ReactNode;
  /** horizontal = label + hint on the left, control on the right (switches, compact settings). */
  orientation?: "vertical" | "horizontal";
  className?: string;
  children: ReactNode;
};

/**
 * Label + control + hint + error, with accessible wiring. The single child element receives
 * `id`, `aria-describedby`, `aria-invalid` and `aria-required` (existing values are kept/merged).
 *
 *   <Field label="Email" hint="Used for sign-in" error={errors.email} required>
 *     <Input value={email} onChange={…} />
 *   </Field>
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  labelAction,
  orientation = "vertical",
  className,
  children,
}: FieldProps) {
  const autoId = useId();
  const hasError = error != null && error !== false && error !== "";
  const only = Children.count(children) === 1 && isValidElement(children) ? (children as ReactElement<Record<string, unknown>>) : null;
  const controlId = htmlFor ?? (only?.props.id as string | undefined) ?? `${autoId}-control`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = hasError ? `${controlId}-error` : undefined;

  let control: ReactNode = children;
  if (only) {
    const describedBy = [only.props["aria-describedby"] as string | undefined, hintId, errorId].filter(Boolean).join(" ");
    control = cloneElement(only, {
      id: controlId,
      "aria-describedby": describedBy || undefined,
      "aria-invalid": hasError ? true : only.props["aria-invalid"],
      "aria-required": required ? true : only.props["aria-required"],
    });
  }

  const labelRow =
    label != null || labelAction != null ? (
      <div className="flex min-h-5 items-center justify-between gap-2">
        {label != null && (
          <Label htmlFor={controlId} required={required}>
            {label}
          </Label>
        )}
        {labelAction}
      </div>
    ) : null;

  const hintNode = hint ? (
    <p id={hintId} className="text-xs text-muted-foreground">
      {hint}
    </p>
  ) : null;

  const errorNode = hasError ? (
    <p id={errorId} className="flex items-start gap-1 text-xs font-medium text-danger">
      <AlertCircle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{error}</span>
    </p>
  ) : null;

  if (orientation === "horizontal") {
    return (
      <div className={cn("flex items-start justify-between gap-4", className)}>
        <div className="min-w-0 space-y-0.5">
          {labelRow}
          {hintNode}
          {errorNode}
        </div>
        <div className="shrink-0 pt-px">{control}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {labelRow}
      {control}
      {hintNode}
      {errorNode}
    </div>
  );
}

type FieldGroupProps = {
  /** Columns from the `sm` breakpoint up (1 column below). Default 2. */
  columns?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
};

/** Responsive grid of Fields. Use `className="sm:col-span-2"` on a Field to span the row. */
export function FieldGroup({ columns = 2, className, children }: FieldGroupProps) {
  return (
    <div
      className={cn(
        "grid gap-x-4 gap-y-4",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

type FormSectionProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned header content (e.g. a secondary action). */
  actions?: ReactNode;
  /** stacked (default) = header above fields; split = header in a left column on large screens. */
  layout?: "stacked" | "split";
  className?: string;
  children: ReactNode;
};

/**
 * A titled group of fields. Consecutive sections are separated by a divider and spacing,
 * not by heavy cards.
 */
export function FormSection({ title, description, actions, layout = "stacked", className, children }: FormSectionProps) {
  const titleId = useId();
  const header = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <h3 id={titleId} className="text-base font-semibold leading-6 text-foreground">
          {title}
        </h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "border-t border-border pt-6 first:border-t-0 first:pt-0 [&+&]:mt-6",
        layout === "split" ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-8" : "space-y-4",
        className,
      )}
    >
      {header}
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}
