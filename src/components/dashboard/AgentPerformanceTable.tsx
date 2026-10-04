import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Users } from "lucide-react";
import { formatDurationMs, formatNumber, formatPercent } from "@/lib/format";
import { filterRows } from "@/lib/table-filters";
import { Button } from "@/components/ui/button";
import { DataTable, type Column, type DataTableEmpty } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { FailureReasonsPopover } from "@/components/logs/FailureReasonsPopover";
import type { AgentMetric } from "@/types/api";
import { agentDisplayName, successRatio } from "./dashboard-utils";

type AgentPerformanceTableProps = {
  accountId: number | null;
  agents: AgentMetric[];
  loading?: boolean;
  /** Load error message; renders in the table body with a retry. */
  error?: string | null;
  onRetry?: () => void;
};

/** Per-agent AI usage, outcomes and response time (all time, computed live by the API). */
export function AgentPerformanceTable({ accountId, agents, loading = false, error, onRetry }: AgentPerformanceTableProps) {
  const [search, setSearch] = useState("");
  const [usageFilter, setUsageFilter] = useState("ALL");
  const [escalationFilter, setEscalationFilter] = useState("ALL");
  const [responseFilter, setResponseFilter] = useState("ALL");

  // Filters belong to one account: start clean when the workspace changes.
  useEffect(() => {
    setSearch("");
    setUsageFilter("ALL");
    setEscalationFilter("ALL");
    setResponseFilter("ALL");
  }, [accountId]);

  const filteredAgents = useMemo(
    () =>
      filterRows(
        agents,
        search,
        (r) =>
          [
            agentDisplayName(r),
            r.agent_email ?? "",
            String(r.user_id),
            String(r.ai_usage_count ?? ""),
            String(r.successful_answers ?? ""),
          ].join(" "),
        [
          (r) => {
            const usage = r.ai_usage_count ?? 0;
            if (usageFilter === "LOW") return usage < 10;
            if (usageFilter === "MEDIUM") return usage >= 10 && usage < 50;
            if (usageFilter === "HIGH") return usage >= 50;
            return true;
          },
          (r) => {
            const esc = r.escalation_count ?? 0;
            if (escalationFilter === "WITH") return esc > 0;
            if (escalationFilter === "NONE") return esc === 0;
            return true;
          },
          (r) => {
            const ms = r.avg_response_time;
            if (responseFilter === "FAST") return ms != null && ms < 3000;
            if (responseFilter === "SLOW") return ms != null && ms >= 3000;
            if (responseFilter === "UNKNOWN") return ms == null;
            return true;
          },
        ],
      ),
    [agents, search, usageFilter, escalationFilter, responseFilter],
  );

  function clearFilters() {
    setSearch("");
    setUsageFilter("ALL");
    setEscalationFilter("ALL");
    setResponseFilter("ALL");
  }

  const columns: Column<AgentMetric>[] = [
    {
      key: "agent",
      header: "Agent",
      sortable: true,
      sortValue: (r) => agentDisplayName(r).toLowerCase(),
      minWidth: 220,
      render: (r) => {
        const name = agentDisplayName(r);
        const showEmail = r.agent_email && r.agent_email !== name;
        return (
          <div className="min-w-0 max-w-[20rem]">
            <p className="truncate font-medium text-foreground" title={name}>
              <span dir="auto">{name}</span>
            </p>
            {showEmail && (
              <p className="truncate text-xs text-muted-foreground" title={r.agent_email ?? undefined}>
                {r.agent_email}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "ai_usage_count",
      header: "AI usage",
      numeric: true,
      sortable: true,
      render: (r) => formatNumber(r.ai_usage_count),
    },
    {
      key: "successful_answers",
      header: "Successful",
      numeric: true,
      sortable: true,
      render: (r) => formatNumber(r.successful_answers),
    },
    {
      key: "failed_answers",
      header: "Failed",
      numeric: true,
      sortable: true,
      render: (r) => {
        const n = r.failed_answers ?? 0;
        if (n <= 0) return formatNumber(r.failed_answers);
        return (
          <span className="inline-flex items-center justify-end gap-1.5">
            <FailureReasonsPopover reasons={r.failure_reasons} />
            <span className="font-medium text-danger">{formatNumber(n)}</span>
          </span>
        );
      },
    },
    {
      key: "success_rate",
      header: "Success rate",
      numeric: true,
      sortable: true,
      sortValue: (r) => successRatio(r.successful_answers, r.failed_answers),
      render: (r) => formatPercent(successRatio(r.successful_answers, r.failed_answers)),
    },
    {
      key: "escalation_count",
      header: "Escalations",
      numeric: true,
      sortable: true,
      render: (r) => formatNumber(r.escalation_count),
    },
    {
      key: "avg_response_time",
      header: "Avg response",
      numeric: true,
      sortable: true,
      render: (r) => formatDurationMs(r.avg_response_time),
    },
  ];

  const isFiltered = filteredAgents.length !== agents.length;
  let empty: DataTableEmpty;
  if (error) {
    empty = {
      icon: AlertCircle,
      title: "Couldn't load agent metrics",
      description: error,
      action: onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : undefined,
    };
  } else if (agents.length === 0) {
    empty = {
      icon: Users,
      title: "No agent activity yet",
      description: "Agents appear here after they use AI in chat for this account.",
    };
  } else {
    empty = {
      title: "No agents match these filters",
      action: (
        <Button variant="outline" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      ),
    };
  }

  return (
    <DataTable<AgentMetric>
      aria-label="Agent performance"
      columns={columns}
      data={error ? [] : filteredAgents}
      keyFn={(r) => r.user_id}
      loading={loading}
      empty={empty}
      itemLabel="agents"
      defaultSort={{ key: "ai_usage_count", dir: "desc" }}
      toolbar={
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by agent name, email, or user ID…"
          filters={[
            {
              id: "agent-usage-filter",
              label: "AI usage",
              value: usageFilter,
              onChange: setUsageFilter,
              options: [
                { value: "ALL", label: "All levels" },
                { value: "LOW", label: "Under 10" },
                { value: "MEDIUM", label: "10 – 49" },
                { value: "HIGH", label: "50+" },
              ],
            },
            {
              id: "agent-response-filter",
              label: "Avg response",
              value: responseFilter,
              onChange: setResponseFilter,
              options: [
                { value: "ALL", label: "All" },
                { value: "FAST", label: "Under 3s" },
                { value: "SLOW", label: "3s or more" },
              ],
            },
            {
              id: "agent-escalation-filter",
              label: "Escalations",
              value: escalationFilter,
              onChange: setEscalationFilter,
              options: [
                { value: "ALL", label: "All" },
                { value: "WITH", label: "With escalations" },
                { value: "NONE", label: "No escalations" },
              ],
            },
          ]}
          onClear={clearFilters}
          totalCount={isFiltered ? agents.length : undefined}
          filteredCount={filteredAgents.length}
          itemLabel="agents"
        />
      }
    />
  );
}
