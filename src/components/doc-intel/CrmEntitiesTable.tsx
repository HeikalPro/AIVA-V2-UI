import { useEffect, useState, type ReactNode } from "react";
import { Contact, Eye } from "lucide-react";
import { useCrmEntity } from "@/hooks/useSharePointSync";
import { formatDateTime } from "@/lib/format";
import {
  ENTITY_STATUSES,
  ENTITY_STATUS_LABELS,
  KNOWN_ENTITY_TYPES,
  entityTypeLabel,
  formatConfidence,
} from "@/lib/sharepoint-sync";
import { formatUserError } from "@/lib/errors";
import { DataTable, actionsColumn, type Column, type DataTableEmpty, type ServerPaginationOptions } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Status } from "@/components/data/status";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  if (entity.is_valid === true) return <Status tone="success" label="Valid" />;
  if (entity.is_valid === false) {
    const n = entity.issues?.length ?? 0;
    return <Status tone="warning" label={n > 0 ? `${n} ${n === 1 ? "issue" : "issues"}` : "Not valid"} />;
  }
  return <span className="text-muted-foreground">—</span>;
}

// ---- Details dialog --------------------------------------------------------------------------

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-ui text-foreground">{children}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>;
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
    <Dialog open onOpenChange={(open) => !open && onClose()} size="lg">
      <DialogContent>
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <DialogTitle className="break-words">
                <span dir="auto">{title}</span>
              </DialogTitle>
              <DialogDescription>
                {entityTypeLabel(e.entity_type)} · Entity <span className="font-mono">#{e.id}</span>
              </DialogDescription>
            </div>
            <EntityStatusBadge status={e.status} className="mt-1" />
          </div>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {detail.isError && (
            <ErrorAlert message={`Couldn't refresh this entity: ${formatUserError(detail.error)}`} />
          )}

          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Fact label="Source">
              <bdi>{e.source_name ?? `Source #${e.source_id}`}</bdi>
            </Fact>
            <Fact label="Source file">
              <bdi className="[overflow-wrap:anywhere]">{e.file_name ?? `File #${e.source_file_id}`}</bdi>
            </Fact>
            <Fact label="Confidence">{formatConfidence(e.confidence)}</Fact>
            <Fact label="Validation">
              <Validity entity={e} />
            </Fact>
            <Fact label="Extractors">{extractors.length ? extractors.join(", ") : "—"}</Fact>
            <Fact label="Extracted">{formatDateTime(e.created_at)}</Fact>
            {e.updated_at && e.updated_at !== e.created_at && <Fact label="Updated">{formatDateTime(e.updated_at)}</Fact>}
            {e.status === "WITHDRAWN" && (
              <Fact label="Withdrawn">
                {formatDateTime(e.withdrawn_at)}
                <span className="block text-xs text-muted-foreground">The file was deleted or re-processed.</span>
              </Fact>
            )}
          </dl>

          {issues.length > 0 && (
            <section className="space-y-2">
              <SectionTitle>Validation issues ({issues.length})</SectionTitle>
              <ul className="space-y-2">
                {issues.map((issue, i) => (
                  <li key={i}>
                    <Alert tone={issue.severity === "error" ? "danger" : "warning"}>
                      <span dir="auto">{asText(issue.message) ?? asText(issue.code) ?? "Validation issue"}</span>
                      <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                        {[asText(issue.severity), asText(issue.field), asText(issue.code)].filter(Boolean).join(" · ")}
                      </span>
                    </Alert>
                  </li>
                ))}
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
                        <span className="text-xs font-medium text-muted-foreground">{fieldLabel(name)}</span>
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
                              <li key={i} className="rounded-md border border-border bg-surface-muted px-2 py-1.5 text-xs">
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

        <DialogFooter>
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
  /** Overrides the default empty states. */
  empty?: DataTableEmpty;
  pagination?: ServerPaginationOptions;
  toolbarEnd?: ReactNode;
};

/** Extracted CRM entities with type / status / search filters and a details dialog (fields + provenance). */
export function CrmEntitiesTable({ entities, loading, filters, onFiltersChange, empty, pagination, toolbarEnd }: Props) {
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

  function clearFilters() {
    setSearch("");
    onFiltersChange(EMPTY_ENTITY_FILTERS);
  }

  const columns: Column<CrmEntityOut>[] = [
    {
      key: "type",
      header: "Type",
      render: (e) => <span className="whitespace-nowrap font-medium text-foreground">{entityTypeLabel(e.entity_type)}</span>,
    },
    {
      key: "value",
      header: "Value",
      truncate: true,
      maxWidth: "18rem",
      cellTitle: (e) => e.display_value ?? undefined,
      render: (e) => <span dir="auto">{e.display_value?.trim() || "—"}</span>,
    },
    { key: "confidence", header: "Confidence", numeric: true, render: (e) => formatConfidence(e.confidence) },
    { key: "valid", header: "Valid", render: (e) => <Validity entity={e} /> },
    {
      key: "file",
      header: "Source file",
      truncate: true,
      maxWidth: "14rem",
      cellTitle: (e) => e.file_name ?? undefined,
      render: (e) => <bdi>{e.file_name ?? `File #${e.source_file_id}`}</bdi>,
    },
    {
      key: "status",
      header: "Status",
      render: (e) => (
        <div className="space-y-0.5">
          <EntityStatusBadge status={e.status} />
          {e.status === "WITHDRAWN" && e.withdrawn_at && (
            <p className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(e.withdrawn_at)}</p>
          )}
        </div>
      ),
    },
    actionsColumn<CrmEntityOut>((e) => [{ label: "Details", icon: Eye, onSelect: () => setSelected(e) }], {
      label: (e) => `Actions for ${e.display_value || entityTypeLabel(e.entity_type)}`,
    }),
  ];

  return (
    <>
      <DataTable<CrmEntityOut>
        aria-label="CRM entities"
        columns={columns}
        data={entities}
        keyFn={(e) => e.id}
        loading={loading}
        itemLabel="entities"
        itemLabelSingular="entity"
        pagination={pagination ?? false}
        onRowClick={(e) => setSelected(e)}
        toolbarEnd={toolbarEnd}
        empty={
          empty ??
          (filtered
            ? {
                title: "No entities match these filters",
                action: (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ),
              }
            : { icon: Contact, title: "No CRM entities extracted yet" })
        }
        toolbar={
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search name, email, phone…"
            filters={[
              {
                id: "crm-entity-type",
                label: "Type",
                value: filters.entityType,
                allValue: "",
                onChange: (v) => onFiltersChange({ ...filters, entityType: v }),
                options: [{ value: "", label: "All" }, ...typeOptions.map((t) => ({ value: t, label: entityTypeLabel(t) }))],
              },
              {
                id: "crm-entity-status",
                label: "Status",
                value: filters.status,
                onChange: (v) => onFiltersChange({ ...filters, status: v as CrmEntityFilters["status"] }),
                options: [{ value: "ALL", label: "All" }, ...ENTITY_STATUSES.map((s) => ({ value: s, label: ENTITY_STATUS_LABELS[s] }))],
              },
            ]}
            onClear={clearFilters}
            isFiltered={filtered || search.trim() !== ""}
          />
        }
      />

      {selected && <CrmEntityDetailsDialog entity={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
