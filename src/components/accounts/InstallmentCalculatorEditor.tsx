import { useId } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CALCULATOR_TENOR_OPTIONS,
  CALCULATOR_TYPE_OPTIONS,
  type CalculatorProductForm,
  type CalculatorTypeKey,
} from "@/lib/calculatorDefaults";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type Products = Record<CalculatorTypeKey, CalculatorProductForm>;

type Props = {
  enabled: boolean;
  types: string[];
  products: Products;
  onEnabledChange: (enabled: boolean) => void;
  onTypesChange: (types: string[]) => void;
  onProductsChange: (products: Products) => void;
};

/**
 * Account-level installment calculator settings (widget feature). At least one product type and,
 * per product, at least one tenor stay selected — the last one cannot be turned off.
 */
export function InstallmentCalculatorEditor({
  enabled,
  types,
  products,
  onEnabledChange,
  onTypesChange,
  onProductsChange,
}: Props) {
  const baseId = useId();

  function setProduct(type: CalculatorTypeKey, product: CalculatorProductForm) {
    onProductsChange({ ...products, [type]: product });
  }

  return (
    <div className="space-y-4">
      <Field
        orientation="horizontal"
        label="Show the installment calculator in the widget"
        hint="For Halan-style accounts. Other accounts can leave this off."
      >
        <Switch checked={enabled} onCheckedChange={(v) => onEnabledChange(v === true)} />
      </Field>

      {enabled && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {CALCULATOR_TYPE_OPTIONS.map((opt) => {
            const typeKey = opt.key as CalculatorTypeKey;
            const on = types.includes(opt.key);
            const product = products[typeKey];
            const typeId = `${baseId}-${typeKey}`;
            const isLastType = on && types.length === 1;
            return (
              <li key={opt.key} className="px-3 py-3">
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    id={typeId}
                    checked={on}
                    disabled={isLastType}
                    title={isLastType ? "At least one product stays selected" : undefined}
                    onCheckedChange={() => {
                      const next = on ? types.filter((t) => t !== opt.key) : [...types, opt.key];
                      if (next.length === 0) return;
                      onTypesChange(next);
                    }}
                  />
                  <label htmlFor={typeId} className="cursor-pointer text-sm font-medium text-foreground">
                    {opt.label}
                  </label>
                  <span className="text-xs text-muted-foreground">{opt.usesApr ? "APR based" : "Flat monthly rate"}</span>
                </div>

                {on && (
                  <div className="mt-3 space-y-3 pl-6">
                    {opt.usesApr && (
                      <Field label="APR (%)" className="max-w-[10rem]">
                        <Input
                          inputMode="decimal"
                          controlSize="sm"
                          value={product.aprPercent}
                          placeholder="55"
                          onChange={(e) => setProduct(typeKey, { ...product, aprPercent: e.target.value })}
                        />
                      </Field>
                    )}

                    <div className="space-y-1.5">
                      <p id={`${typeId}-tenors`} className="text-ui font-medium text-foreground">
                        Tenors (months)
                      </p>
                      <div role="group" aria-labelledby={`${typeId}-tenors`} className="flex flex-wrap gap-1.5">
                        {CALCULATOR_TENOR_OPTIONS.map((month) => {
                          const tenorOn = product.tenors.includes(month);
                          return (
                            <Button
                              key={month}
                              type="button"
                              variant="outline"
                              size="sm"
                              aria-pressed={tenorOn}
                              aria-label={`${month} months`}
                              onClick={() => {
                                const nextTenors = tenorOn
                                  ? product.tenors.filter((t) => t !== month)
                                  : [...product.tenors, month];
                                if (nextTenors.length === 0) return;
                                setProduct(typeKey, { ...product, tenors: nextTenors });
                              }}
                              className={cn(
                                "h-7 min-w-[3.25rem] rounded-full px-2.5 tabular-nums",
                                tenorOn
                                  ? "border-primary/60 bg-primary-muted text-primary-muted-foreground hover:border-primary hover:bg-primary-muted hover:text-primary-muted-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {tenorOn && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
                              {month}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    {!opt.usesApr && (
                      <div className="space-y-1.5">
                        <p className="text-ui font-medium text-foreground">Flat rate per month (%)</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {[...product.tenors]
                            .sort((a, b) => a - b)
                            .map((month) => (
                              <Field key={month} label={<span className="text-xs text-muted-foreground">{month} months</span>}>
                                <Input
                                  inputMode="decimal"
                                  controlSize="sm"
                                  className="tabular-nums"
                                  value={product.flatRatePercents[String(month)] ?? ""}
                                  onChange={(e) =>
                                    setProduct(typeKey, {
                                      ...product,
                                      flatRatePercents: { ...product.flatRatePercents, [String(month)]: e.target.value },
                                    })
                                  }
                                />
                              </Field>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
