import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Eye, Search } from "lucide-react";
import { useCrmEntity } from "@/hooks/useSharePointSync";
import { formatWhen } from "@/lib/doc-intel";
import {
  ENTITY_STATUSES,
  ENTITY_STATUS_LABELS,
  KNOWN_ENTITY_TYPES,
  entityTypeLabel,
  formatConfidence,
} from "@/lib/sharepoint-sync";
import { formatUserError } from "@/lib/errors";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EntityStatusBadge } from "@/components/doc-intel/SyncBadges";
import type { CrmEntityOut, EntityStatus } from "@/types/api";

export type CrmEntityFilters = {
  /** "" = every type. */
  entityType: string;
  status: "ALL" | EntityStatus;
  /** Committed search text (debounced from the input). */
  q: string;
};

export const EMPTY_ENTITY_FILTERS: CrmEntityFilters = { entityType: "", status: "ALL", q: "" };

const SEARCH_DEBOUNCE_MS = 300;

// ---- Provenance ("_meta") --------------------------------------------------------------------

type Evidence = { page: number | null; sourceText: string | null; extractor: string | null; blockId: string | null };
type FieldMeta = { confidence: number | null; extractor: string | null; evidence: Evidence[] };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Per-field confidence, extractor and evidence from the entity's "_meta" block (defensive: it is free-form JSON). */
function fieldMeta(provenance: Record<string, unknown>, field: string): FieldMeta {
  const meta = asRecord(asRecord(provenance.fields)?.[field]);
  const evidence = (Array.isArray(meta?.provenance) ? meta.provenance : []).map((item): Evidence => {
    const ev = asRecord(item) ?? {};
    return {
      page: asNumber(ev.page),
      sourceText: asText(ev.source_text),
      extractor: asText(ev.extractor),
      blockId: asText(ev.block_id),
    };
  });
  return { confidence: asNumber(meta?.confidence), extractor: asText(meta?.extractor), evidence };
}

function plainValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function fieldLabel(name: string): string {
  const text = name.replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : name;
}

function Validity({ entity }: { entity: Pick<CrmEntityOut, "is_valid" | "issues"> }) {
  if (entity.is_valid === true) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-emerald-700">
        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> Valid
      </span>
    );
  }
  if (entity.is_valid === false) {
    const n = entity.issues?.length ?? 0;
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-amber-700">
        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
        {n > 0 ? `${n} ${n === 1 ? "issue" : "issues"}` : "Not valid"}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

// ---- Details dialog --------------------------------------------------------------------------

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{children}</h3>;
}

export function CrmEntityDetailsDialog({ entity: snapshot, onClose }: { entity: CrmEntityOut; onClose: () => void }) {
  const detail = useCrmEntity(snapshot.id);
  const e = detail.data ?? snapshot;
  const provenance = asRecord(e.provenance) ?? {};
  const fields = asRecord(e.fields) ?? {};
  // Fields with a value first, then any field that only appears in the provenance.
  const names = [...Object.keys(fields), ...Object.keys(asRecord(provenance.fields) ?? {}).filter((k) => !(k in fields))];
  const extractors = Array.isArray(provenance.extractors) ? provenance.extractors.map(String).filter(Boolean) : [];
  const issues = (e.issues ?? []).map((issue) => asRecord(issue) ?? {});
  const title = e.display_value?.trim() || entityTypeLabel(e.entity_type);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} size="max-w-3xl">
      <DialogContent className="flex max-h-[min(90vh,calc(100dvh-2rem))] flex-col overflow-hidden">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="break-words">
                <span dir="auto">{title}</span>
              </DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {entityTypeLabel(e.entity_type)} · Entity #{e.id}
              </p>
            </div>
            <EntityStatusBadge status={e.status} />
          </div>
        </DialogHeader>

        <DialogBody className="min-h-0 flex-1 space-y-6 pr-1">
          {detail.isError && (
            <ErrorAlert message={`Couldn't refresh this entity: ${formatUserError(detail.error)}`} />
          )}

          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Fact label="Source">{e.source_name ?? `Source #${e.source_id}`}</Fact>
            <Fact label="Source file">
              <bdi className="[overflow-wrap:anywhere]">{e.file_name ?? `File #${e.source_file_id}`}</bdi>
            </Fact>
            <Fact label="Confidence">{formatConfidence(e.confidence)}</Fact>
            <Fact label="Validation">
              <Validity entity={e} />
            </Fact>
            <Fact label="Extractors">{extractors.length ? extractors.join(", ") : "—"}</Fact>
            <Fact label="Extracted">{formatWhen(e.created_at)}</Fact>
            {e.updated_at && e.updated_at !== e.created_at && <Fact label="Updated">{formatWhen(e.updated_at)}</Fact>}
            {e.status === "WITHDRAWN" && (
              <Fact label="Withdrawn">
                {formatWhen(e.withdrawn_at)}
                <span className="block text-xs text-muted-foreground">The file was deleted or re-processed.</span>
              </Fact>
            )}
          </dl>

          {issues.length > 0 && (
            <section className="space-y-2">
              <SectionTitle>Validation issues ({issues.length})</SectionTitle>
              <ul className="space-y-2">
                {issues.map((issue, i) => {
                  const error = issue.severity === "error";
                  return (
                    <li
                      key={i}
                      className={`rounded-lg border px-3 py-2 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}
                    >
                      <p className="break-words">{asText(issue.message) ?? asText(issue.code) ?? "Validation issue"}</p>
                      <p className="mt-0.5 font-mono text-xs opacity-80">
                        {[asText(issue.severity), asText(issue.field), asText(issue.code)].filter(Boolean).join(" · ")}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <SectionTitle>Fields and provenance</SectionTitle>
            {names.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fields were extracted.</p>
            ) : (
              <ul className="space-y-2">
                {names.map((name) => {
                  const meta = fieldMeta(provenance, name);
                  const facts = [
                    meta.confidence != null ? formatConfidence(meta.confidence) : null,
                    meta.extractor,
                  ].filter(Boolean);
                  return (
                    <li key={name} className="rounded-lg border border-border px-3 py-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {fieldLabel(name)}
                        </span>
                        {facts.length > 0 && <span className="text-xs text-muted-foreground">{facts.join(" · ")}</span>}
                      </div>
                      <p dir="auto" className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground [unicode-bidi:plaintext]">
                        {name in fields ? plainValue(fields[name]) : "—"}
                      </p>
                      {meta.evidence.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {meta.evidence.map((ev, i) => {
                            const where = [
                              ev.page != null ? `Page ${ev.page}` : null,
                              ev.extractor,
                              ev.blockId ? `block ${ev.blockId}` : null,
                            ].filter(Boolean);
                            return (
                              <li key={i} className="rounded-md bg-muted px-2 py-1.5 text-xs">
                                <p className="text-muted-foreground">{where.length ? where.join(" · ") : "Source"}</p>
                                {ev.sourceText && (
                                  <p
                                    dir="auto"
                                    className="mt-0.5 whitespace-pre-wrap break-words text-foreground [unicode-bidi:plaintext]"
                                  >
                                    “{ev.sourceText}”
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </DialogBody>

        <DialogFooter className="border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Table -----------------------------------------------------------------------------------

type Props = {
  entities: CrmEntityOut[];
  loading?: boolean;
  filters: CrmEntityFilters;
  onFiltersChange: (next: CrmEntityFilters) => void;
  emptyMessage?: string;
};

/** Extracted CRM entities with type / status / search filters and a details dialog (fields + provenance). */
export function CrmEntitiesTable({ entities, loading, filters, onFiltersChange, emptyMessage }: Props) {
  const [search, setSearch] = useState(filters.q);
  const [selected, setSelected] = useState<CrmEntityOut | null>(null);

  // A reset from outside (Clear filters) replaces the typed text.
  useEffect(() => {
    setSearch((current) => (current.trim() === filters.q ? current : filters.q));
  }, [filters.q]);

  useEffect(() => {
    const q = search.trim();
    if (q === filters.q) return;
    const timer = setTimeout(() => onFiltersChange({ ...filters, q }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, filters, onFiltersChange]);

  const typeOptions = Array.from(
    new Set([...KNOWN_ENTITY_TYPES, ...entities.map((e) => e.entity_type), ...(filters.entityType ? [filters.entityType] : [])]),
  );
  const filtered = filters.entityType !== "" || filters.status !== "ALL" || filters.q !== "";

  const columns: Column<CrmEntityOut>[] = [
    {
      key: "type",
      header: "Type",
      render: (e) => <span className="whitespace-nowrap font-medium text-foreground">{entityTypeLabel(e.entity_type)}</span>,
    },
    {
      key: "value",
      header: "Value",
      render: (e) => (
        <span dir="auto" className="block min-w-[9rem] max-w-[16rem] break-words [overflow-wrap:anywhere]">
          {e.display_value?.trim() || "—"}
        </span>
      ),
    },
    {
      key: "confidence",
      header: "Confidence",
      render: (e) => <span className="tabular-nums">{formatConfidence(e.confidence)}</span>,
    },
    { key: "valid", header: "Valid", render: (e) => <Validity entity={e} /> },
    {
      key: "file",
      header: "Source file",
      render: (e) => (
        <span dir="auto" className="block min-w-[8rem] max-w-[14rem] text-xs [overflow-wrap:anywhere]">
          {e.file_name ?? `File #${e.source_file_id}`}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (e) => (
        <div className="space-y-1">
          <EntityStatusBadge status={e.status} />
          {e.status === "WITHDRAWN" && e.withdrawn_at && (
            <p className="whitespace-nowrap text-xs text-muted-foreground">{formatWhen(e.withdrawn_at)}</p>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (e) => (
        <div onClick={(ev) => ev.stopPropagation()}>
          <Button variant="outline" size="sm" onClick={() => setSelected(e)} aria-label={`Details of ${e.display_value || entityTypeLabel(e.entity_type)}`}>
            <Eye aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Details
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="w-full lg:w-56">
            <Label htmlFor="crm-entity-type">Type</Label>
            <Select
              id="crm-entity-type"
              value={filters.entityType}
              onChange={(e) => onFiltersChange({ ...filters, entityType: e.target.value })}
              className="mt-1"
            >
              <option value="">All types</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {entityTypeLabel(t)}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full lg:w-44">
            <Label htmlFor="crm-entity-status">Status</Label>
            <Select
              id="crm-entity-status"
              value={filters.status}
              onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as CrmEntityFilters["status"] })}
              className="mt-1"
            >
              <option value="ALL">All statuses</option>
              {ENTITY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ENTITY_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full lg:max-w-sm lg:flex-1">
            <Label htmlFor="crm-entity-search">Search</Label>
            <div className="relative mt-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="crm-entity-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email, phone…"
                className="pl-9"
                maxLength={200}
              />
            </div>
          </div>
          {filtered && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearch("");
                onFiltersChange(EMPTY_ENTITY_FILTERS);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={entities}
        keyFn={(e) => e.id}
        loading={loading}
        onRowClick={(e) => setSelected(e)}
        emptyMessage={emptyMessage ?? (filtered ? "No entities match these filters." : "No CRM entities extracted yet.")}
      />

      {selected && <CrmEntityDetailsDialog entity={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
