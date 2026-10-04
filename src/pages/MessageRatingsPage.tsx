import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Lock, MessageSquareText, ThumbsUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES, canAccessPermission } from "@/lib/roles";
import { useMessageRatings } from "@/hooks/useMessageRatings";
import { filterRows } from "@/lib/table-filters";
import { formatUserError } from "@/lib/errors";
import { formatNumber, formatPercent } from "@/lib/format";
import { Page, PageHeading } from "@/components/shell/page";
import { DataTable, type Column } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar, type DateRangeValue } from "@/components/data/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { QueueChips } from "@/components/doc-intel/QueueChips";
import { RelativeTime } from "@/components/doc-intel/RelativeTime";
import { FeedbackReviewSheet, RatingLabel, agentLabel } from "@/components/feedback/FeedbackReviewSheet";
import type { MessageRating } from "@/types/api";

/** Local calendar day (YYYY-MM-DD) of a timestamp, to compare with the date filter. */
function localDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sortedOptions(entries: Map<string, string>, allLabel = "All") {
  return [
    { value: "ALL", label: allLabel },
    ...[...entries.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label })),
  ];
}

export function MessageRatingsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const canView = user ? canAccessPermission(user, "message-ratings") : false;
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN) ?? false;
  const canLoadQuestion = user != null && (canAccessPermission(user, "chat") || isSuperAdmin);
  const { data = [], isLoading, isError, error, refetch } = useMessageRatings(canView);

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [ratingFilter, setRatingFilter] = useState("ALL");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [agentFilter, setAgentFilter] = useState("ALL");
  const [queueFilter, setQueueFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: "", to: "" });
  const [selected, setSelected] = useState<MessageRating | null>(null);

  const accountOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of data) if (!byId.has(String(r.account_id))) byId.set(String(r.account_id), r.account_name ?? `Account #${r.account_id}`);
    return sortedOptions(byId);
  }, [data]);

  const agentOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of data) if (!byId.has(String(r.agent_user_id))) byId.set(String(r.agent_user_id), agentLabel(r));
    return sortedOptions(byId);
  }, [data]);

  const queueOptions = useMemo(() => {
    const keys = new Map<string, string>();
    for (const r of data) for (const q of r.active_queues) keys.set(q, q);
    return [...sortedOptions(keys), { value: "__ALL_QUEUES__", label: "Not narrowed" }];
  }, [data]);

  const filtered = useMemo(
    () =>
      filterRows(
        data,
        search,
        (r) =>
          [
            agentLabel(r),
            r.agent_email ?? "",
            r.account_name ?? "",
            r.organization_name ?? "",
            r.message_text,
            r.feedback ?? "",
            ...r.active_queues,
          ].join(" "),
        [
          (r) => ratingFilter === "ALL" || r.rating === ratingFilter,
          (r) => accountFilter === "ALL" || String(r.account_id) === accountFilter,
          (r) => agentFilter === "ALL" || String(r.agent_user_id) === agentFilter,
          (r) =>
            queueFilter === "ALL" ||
            (queueFilter === "__ALL_QUEUES__" ? r.active_queues.length === 0 : r.active_queues.includes(queueFilter)),
          (r) => {
            if (!dateRange.from && !dateRange.to) return true;
            const day = localDay(r.rated_at);
            if (!day) return false;
            return (!dateRange.from || day >= dateRange.from) && (!dateRange.to || day <= dateRange.to);
          },
        ],
      ),
    [data, ratingFilter, accountFilter, agentFilter, queueFilter, dateRange, search],
  );

  function clearFilters() {
    setSearch("");
    setRatingFilter("ALL");
    setAccountFilter("ALL");
    setAgentFilter("ALL");
    setQueueFilter("ALL");
    setDateRange({ from: "", to: "" });
  }

  const helpful = useMemo(() => filtered.filter((r) => r.rating === "up").length, [filtered]);

  const columns: Column<MessageRating>[] = [
    {
      key: "rating",
      header: "Rating",
      sortable: true,
      render: (r) => <RatingLabel rating={r.rating} />,
    },
    {
      key: "agent",
      header: "Agent",
      sortable: true,
      sortValue: (r) => agentLabel(r).toLowerCase(),
      render: (r) => (
        <div className="min-w-0 max-w-[14rem]">
          <p className="truncate font-medium text-foreground" title={agentLabel(r)}>
            <bdi>{agentLabel(r)}</bdi>
          </p>
          {r.agent_email && r.agent_email !== agentLabel(r) && <p className="truncate text-xs text-muted-foreground">{r.agent_email}</p>}
        </div>
      ),
    },
    {
      key: "account",
      header: "Account",
      sortable: true,
      sortValue: (r) => r.account_name ?? "",
      truncate: true,
      maxWidth: "11rem",
      render: (r) => <bdi>{r.account_name ?? `Account #${r.account_id}`}</bdi>,
    },
    {
      key: "queues",
      header: "Queues",
      render: (r) =>
        r.active_queues.length ? (
          <QueueChips queues={r.active_queues.map((q) => ({ key: q, label: q }))} />
        ) : (
          <Tooltip content="The agent had not narrowed the search: all allowed queues were active">
            <Badge variant="outline" tabIndex={0}>
              All queues
            </Badge>
          </Tooltip>
        ),
    },
    {
      key: "rated_at",
      header: "Rated",
      sortable: true,
      sortValue: (r) => r.rated_at ?? "",
      render: (r) => <RelativeTime value={r.rated_at} />,
    },
    {
      key: "message",
      header: "Answer",
      truncate: true,
      maxWidth: "26rem",
      cellTitle: (r) => r.message_text,
      render: (r) => <span dir="auto">{r.message_text.replace(/\s+/g, " ").trim()}</span>,
    },
    {
      key: "feedback",
      header: <span className="sr-only">Comment</span>,
      label: "Comment",
      align: "center",
      width: 64,
      render: (r) =>
        r.feedback?.trim() ? (
          <Tooltip content={<span dir="auto" className="block max-w-xs whitespace-pre-wrap">{r.feedback}</span>}>
            <span
              tabIndex={0}
              aria-label={`Comment: ${r.feedback}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageSquareText aria-hidden="true" className="h-4 w-4" />
            </span>
          </Tooltip>
        ) : (
          <span className="text-subtle-foreground" aria-label="No comment">
            —
          </span>
        ),
    },
  ];

  if (!canView) {
    return (
      <Page width="wide">
        <PageHeading title="Message Feedback" />
        <EmptyState icon={Lock} title="You don't have access to message feedback" description="Ask an administrator for access." />
      </Page>
    );
  }

  const isFiltered =
    search.trim() !== "" ||
    ratingFilter !== "ALL" ||
    accountFilter !== "ALL" ||
    agentFilter !== "ALL" ||
    queueFilter !== "ALL" ||
    Boolean(dateRange.from || dateRange.to);

  return (
    <Page width="wide">
      <PageHeading
        title="Message Feedback"
        description="Thumbs up / down ratings agents gave AI answers in the desktop widget. Open a row to review the answer."
        meta={
          !isLoading && data.length > 0 ? (
            <span>
              {filtered.length > 0 ? `${formatPercent(helpful / filtered.length, 0)} helpful` : "—"} · {formatNumber(filtered.length)} ratings
            </span>
          ) : undefined
        }
      />

      <DataTable<MessageRating>
        aria-label="Message feedback"
        columns={columns}
        data={isError ? [] : filtered}
        keyFn={(r) => r.message_id}
        loading={isLoading}
        itemLabel="ratings"
        defaultSort={{ key: "rated_at", dir: "desc" }}
        onRowClick={(r) => setSelected(r)}
        rowLabel={(r) => `${agentLabel(r)} rating`}
        empty={
          isError
            ? {
                title: "Couldn't load message feedback",
                description: formatUserError(error),
                action: (
                  <Button variant="outline" size="sm" onClick={() => void refetch()}>
                    Try again
                  </Button>
                ),
              }
            : isFiltered
              ? {
                  title: "No ratings match these filters",
                  action: (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ),
                }
              : { icon: ThumbsUp, title: "No message ratings yet", description: "Ratings appear when agents rate AI answers in the widget." }
        }
        toolbar={
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search ratings…"
            filters={[
              {
                id: "rating",
                label: "Rating",
                value: ratingFilter,
                onChange: setRatingFilter,
                options: [
                  { value: "ALL", label: "All" },
                  { value: "up", label: "Helpful" },
                  { value: "down", label: "Not helpful" },
                ],
              },
              { id: "account", label: "Account", value: accountFilter, onChange: setAccountFilter, options: accountOptions },
              { id: "agent", label: "Agent", value: agentFilter, onChange: setAgentFilter, options: agentOptions, className: "max-w-[16rem]" },
              { id: "queue", label: "Queue", value: queueFilter, onChange: setQueueFilter, options: queueOptions },
            ]}
            dateRange={{ ...dateRange, onChange: setDateRange, presets: true, label: "Rated" }}
            onClear={clearFilters}
            isFiltered={isFiltered}
            totalCount={isFiltered ? data.length : undefined}
            filteredCount={filtered.length}
            itemLabel="ratings"
          />
        }
      />

      <FeedbackReviewSheet rating={selected} canLoadQuestion={canLoadQuestion} onClose={() => setSelected(null)} />
    </Page>
  );
}
