import {
  ALL_CALCULATOR_TYPES,
  buildCalculatorProductsPayload,
  calculatorProductsFromAccount,
  type CalculatorProductForm,
  type CalculatorTypeKey,
} from "@/lib/calculatorDefaults";
import type { Account, WidgetFeatures, WidgetLocationItem } from "@/types/api";

/*
 * Widget Configuration form state and the exact `widget_features` payload sent with
 * PATCH /api/accounts/:id. Moved unchanged from WidgetCustomizationPage.
 */

export type LocationForm = {
  name: string;
  area: string;
  address: string;
  phone: string;
  hours: string;
  mapsUrl: string;
};

export const EMPTY_LOCATION: LocationForm = { name: "", area: "", address: "", phone: "", hours: "", mapsUrl: "" };

export type WidgetForm = {
  calcEnabled: boolean;
  calcTypes: CalculatorTypeKey[];
  calcProducts: Record<CalculatorTypeKey, CalculatorProductForm>;
  kbOverride: boolean;
  kbVisibleKeys: string[];
  brandTitle: string;
  brandSubtitle: string;
  brandAccent: string;
  brandLogoUrl: string;
  locEnabled: boolean;
  locations: LocationForm[];
};

export const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function calculatorTypesFromAccount(acc: Account | null): CalculatorTypeKey[] {
  const types = acc?.widget_features?.installment_calculator?.types;
  if (Array.isArray(types) && types.length > 0) {
    return types.filter((t): t is CalculatorTypeKey => ALL_CALCULATOR_TYPES.includes(t as CalculatorTypeKey));
  }
  return [...ALL_CALCULATOR_TYPES];
}

function locationsFromAccount(acc: Account | null): LocationForm[] {
  const items = acc?.widget_features?.locations?.items;
  if (!Array.isArray(items)) return [];
  return items.map((it) => ({
    name: it.name ?? "",
    area: it.area ?? "",
    address: it.address ?? "",
    phone: it.phone ?? "",
    hours: it.hours ?? "",
    mapsUrl: it.maps_url ?? "",
  }));
}

export function formFromAccount(acc: Account | null): WidgetForm {
  const calc = acc?.widget_features?.installment_calculator;
  const kb = acc?.widget_features?.kb_queues;
  const brand = acc?.widget_features?.branding;
  const kbOverride = kb != null && Array.isArray(kb.visible_keys);
  return {
    calcEnabled: calc?.enabled ?? false,
    calcTypes: calculatorTypesFromAccount(acc),
    calcProducts: calculatorProductsFromAccount(calc?.types ?? [], calc?.products),
    kbOverride,
    kbVisibleKeys: kbOverride ? [...(kb!.visible_keys as string[])] : [],
    brandTitle: brand?.title ?? "",
    brandSubtitle: brand?.subtitle ?? "",
    brandAccent: brand?.accent_color ?? "",
    brandLogoUrl: brand?.logo_url ?? "",
    locEnabled: acc?.widget_features?.locations?.enabled ?? false,
    locations: locationsFromAccount(acc),
  };
}

export function buildWidgetFeatures(form: WidgetForm): WidgetFeatures {
  const activeTypes = form.calcEnabled ? form.calcTypes : [];
  const branding = {
    title: form.brandTitle.trim() || null,
    subtitle: form.brandSubtitle.trim() || null,
    accent_color: form.brandAccent.trim() || null,
    logo_url: form.brandLogoUrl.trim() || null,
  };
  const hasBranding = Object.values(branding).some((v) => v != null);
  const locationItems: WidgetLocationItem[] = form.locations
    .filter((l) => l.name.trim())
    .map((l) => ({
      name: l.name.trim(),
      area: l.area.trim() || null,
      address: l.address.trim() || null,
      phone: l.phone.trim() || null,
      hours: l.hours.trim() || null,
      maps_url: l.mapsUrl.trim() || null,
    }));
  const wf: WidgetFeatures = {
    installment_calculator: {
      enabled: form.calcEnabled,
      types: activeTypes,
      products: form.calcEnabled ? buildCalculatorProductsPayload(activeTypes, form.calcProducts) : undefined,
    },
    // null clears the override (widget shows every allowed KB button).
    kb_queues: form.kbOverride ? { visible_keys: form.kbVisibleKeys } : null,
    // null clears branding back to defaults.
    branding: hasBranding ? branding : null,
    // null clears the section entirely when it's off and empty.
    locations: form.locEnabled || locationItems.length > 0 ? { enabled: form.locEnabled, items: locationItems } : null,
  };
  return wf;
}
