import { useMemo, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/roles";
import { useMessageRatings } from "@/hooks/useMessageRatings";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { TableFilters } from "@/components/shared/TableFilters";
import { filterRows } from "@/lib/table-filters";
import type { MessageRating } from "@/types/api";

function agentLabel(row: MessageRating): string {
  const name = [row.agent_first_name, row.agent_last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  return row.agent_email ?? `Agent #${row.agent_user_id}`;
}

function snippet(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function MessageRatingsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN) ?? false;
  const { data = [], isLoading } = useMessageRatings(isSuperAdmin);

  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("ALL");
  const [accountFilter, setAccountFilter] = useState("ALL");

  const accountOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const r of data) {
      if (!byId.has(r.account_id)) {
        byId.set(r.account_id, r.account_name ?? `Account #${r.account_id}`);
      }
    }
    return [
      { value: "ALL", label: "All accounts" },
      ...[...byId.entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id, name]) => ({ value: String(id), label: name })),
    ];
  }, [data]);

  const filtered = useMemo(
    () =>
      filterRows(
        data
          .filter((r) => ratingFilter === "ALL" || r.rating === ratingFilter)
          .filter((r) => accountFilter === "ALL" || String(r.account_id) === accountFilter),
        search,
        (r) =>
          [
            agentLabel(r),
            r.agent_email ?? "",
            r.account_name ?? "",
            r.organization_name ?? "",
            r.message_text,
            r.feedback ?? "",
          ].join(" "),
      ),
    [data, ratingFilter, accountFilter, search],
  );

  const columns: Column<MessageRating>[] = [
    {
      key: "rated_at",
      header: "Rated",
      sortable: true,
      sortValue: (r) => r.rated_at ?? "",
      render: (r) => (r.rated_at ? new Date(r.rated_at).toLocaleString() : "—"),
    },
    {
      key: "rating",
      header: "Rating",
      render: (r) =>
        r.rating === "up" ? (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <ThumbsUp className="h-3.5 w-3.5" /> Helpful
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-rose-700">
            <ThumbsDown className="h-3.5 w-3.5" /> Not helpful
          </span>
        ),
    },
    {
      key: "agent",
      header: "Agent",
      sortable: true,
      sortValue: (r) => agentLabel(r),
      render: (r) => (
        <div>
          <div className="font-medium text-slate-900">{agentLabel(r)}</div>
          {r.agent_email && <div className="text-xs text-slate-500">{r.agent_email}</div>}
        </div>
      ),
    },
    {
      key: "organization",
      header: "Organization",
      sortable: true,
      sortValue: (r) => r.organization_name ?? "",
      render: (r) => r.organization_name ?? `Org #${r.organization_id}`,
    },
    {
      key: "account",
      header: "Account",
      sortable: true,
      sortValue: (r) => r.account_name ?? "",
      render: (r) => r.account_name ?? `Account #${r.account_id}`,
    },
    {
      key: "message",
      header: "Answer",
      render: (r) => <span title={r.message_text}>{snippet(r.message_text)}</span>,
    },
    {
      key: "feedback",
      header: "Feedback",
      render: (r) =>
        r.feedback?.trim() ? (
          <span className="text-sm text-slate-700" title={r.feedback}>
            {snippet(r.feedback, 80)}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
  ];

  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader icon={ThumbsUp} title="Message feedback" description="Super Admin only." />
        <p className="text-sm text-slate-600">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        icon={ThumbsUp}
        title="Message feedback"
        description="Thumbs up/down ratings submitted by agents from the desktop widget."
      />
      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search agent, account, message, feedback…"
        totalCount={data.length}
        filteredCount={filtered.length}
        onClear={() => {
          setSearch("");
          setRatingFilter("ALL");
          setAccountFilter("ALL");
        }}
        filters={[
          {
            id: "account",
            label: "Account",
            value: accountFilter,
            onChange: setAccountFilter,
            options: accountOptions,
          },
          {
            id: "rating",
            label: "Rating",
            value: ratingFilter,
            onChange: setRatingFilter,
            options: [
              { value: "ALL", label: "All ratings" },
              { value: "up", label: "Helpful" },
              { value: "down", label: "Not helpful" },
            ],
          },
        ]}
      />
      <DataTable
        columns={columns}
        data={filtered}
        keyFn={(r) => r.message_id}
        loading={isLoading}
        emptyMessage="No message ratings yet."
      />
    </div>
  );
}
