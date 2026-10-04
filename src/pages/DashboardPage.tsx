import { useMemo, useState } from "react";
import { AlertCircle, BarChart3, Building2, Clock, Coins, Gauge, Lock, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ROLES, canAccess, canAccessPermission } from "@/lib/roles";
import { ApiError, formatUserError } from "@/lib/errors";
import { formatDurationMs, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { useAgentMetrics, useAiTimeseries, useDashboardStats } from "@/hooks/useAnalytics";
import { useAiMetrics } from "@/hooks/useLogs";
import { Page, PageHeading } from "@/components/shell/page";
import { Stat, StatGroup } from "@/components/data/stat";
import { EmptyState } from "@/components/data/empty-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { AiActivityCard } from "@/components/dashboard/AiActivityCard";
import { AnswerOutcomesCard } from "@/components/dashboard/AnswerOutcomesCard";
import { AiCostCard } from "@/components/dashboard/AiCostCard";
import { AgentPerformanceTable } from "@/components/dashboard/AgentPerformanceTable";
import { RANGE_OPTIONS, lastNDays, rangeLabel, type RangeDays } from "@/components/dashboard/dashboard-utils";

const ANALYTICS_VIEW_ROLES = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR];
/** Mirrors the backend gate on /api/logs/ai-metrics: SA, OA, DEV, or the "logs" page permission. */
const AI_METRICS_ROLES = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.DEVELOPER];

function isForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403;
}

export function DashboardPage() {
  const { user } = useAuth();
  const workspace = useWorkspace();
  const canViewDashboard = user ? canAccessPermission(user, "dashboard") : false;
  const canViewAnalytics =
    user != null && (canAccessPermission(user, "dashboard") || canAccess(user.roles, ANALYTICS_VIEW_ROLES));
  const canViewAiMetrics =
    user != null && (canAccess(user.roles, AI_METRICS_ROLES) || canAccessPermission(user, "logs"));

  const accountId = workspace.accountId;
  const [days, setDays] = useState<RangeDays>(30);
  const range = useMemo(() => lastNDays(days), [days]);

  const stats = useDashboardStats(accountId, canViewAnalytics);
  const agentsQuery = useAgentMetrics(accountId, canViewAnalytics);
  const timeseries = useAiTimeseries(accountId, days, canViewAnalytics && accountId != null);
  const aiMetrics = useAiMetrics(
    { account_id: accountId, start: range.start, end: range.end },
    canViewAnalytics && canViewAiMetrics && accountId != null,
  );

  const agents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data]);
  const agentTotals = useMemo(() => {
    let successful = 0;
    let failed = 0;
    let escalations = 0;
    for (const a of agents) {
      successful += a.successful_answers ?? 0;
      failed += a.failed_answers ?? 0;
      escalations += a.escalation_count ?? 0;
    }
    return { successful, failed, escalations, answered: successful + failed };
  }, [agents]);

  if (!canViewDashboard) {
    return (
      <Page width="wide">
        <PageHeading title="Dashboard" />
        <EmptyState icon={Lock} title="You don't have access to the dashboard" description="Ask an administrator for dashboard access." />
      </Page>
    );
  }

  const accountName = workspace.account?.name;
  const heading = (
    <PageHeading
      title="Dashboard"
      description={
        accountName
          ? `Usage, answer quality, speed and cost of AIVA for ${accountName}.`
          : "Usage, answer quality, speed and cost of AIVA."
      }
      actions={
        canViewAnalytics && accountId != null ? (
          <Select
            aria-label="Date range"
            value={days}
            onChange={(event) => setDays(Number(event.target.value) as RangeDays)}
            className="w-40"
          >
            {RANGE_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {rangeLabel(d)}
              </option>
            ))}
          </Select>
        ) : undefined
      }
    />
  );

  if (!workspace.isLoading && accountId == null) {
    return (
      <Page width="wide">
        {heading}
        <EmptyState
          icon={Building2}
          title="No account selected"
          description={
            user?.roles.includes(ROLES.SUPER_ADMIN)
              ? "There are no accounts yet. Create one on the Accounts page to see its analytics here."
              : "You don't have access to any account yet. Ask an administrator to add you to one."
          }
        />
      </Page>
    );
  }

  if (!canViewAnalytics) {
    return (
      <Page width="wide">
        {heading}
        <EmptyState icon={BarChart3} title="Analytics aren't available for your role" />
      </Page>
    );
  }

  // ---- sources -------------------------------------------------------------------------------
  // Range KPIs come from /api/logs/ai-metrics when the user may read it; otherwise all-time totals
  // from /api/analytics/dashboard (+ agent metrics for the success rate). A 403 (permissions out of
  // sync with the backend) falls back silently; other errors are reported.
  const workspaceLoading = workspace.isLoading;
  const aiAvailable = canViewAiMetrics && !aiMetrics.isError;
  const ai = aiAvailable ? aiMetrics.data : undefined;
  const summary = ai?.summary;
  const windowHint = rangeLabel(days);
  const statsLoading = workspaceLoading || stats.isLoading;
  const aiLoading = workspaceLoading || (aiAvailable && aiMetrics.isLoading);
  const agentsLoading = workspaceLoading || agentsQuery.isLoading;

  const s = stats.data;
  const fallbackSuccess = agentTotals.answered > 0 ? agentTotals.successful / agentTotals.answered : null;

  const errors: { label: string; message: string; retry: () => void }[] = [];
  if (stats.isError) errors.push({ label: "Account totals", message: formatUserError(stats.error), retry: () => void stats.refetch() });
  if (canViewAiMetrics && aiMetrics.isError && !isForbidden(aiMetrics.error)) {
    errors.push({ label: "Range metrics", message: formatUserError(aiMetrics.error), retry: () => void aiMetrics.refetch() });
  }

  const outcomes = aiAvailable
    ? {
        successful: summary?.success_count ?? 0,
        failed: summary?.failed_count ?? 0,
        sourceLabel: `${windowHint} · AI request logs`,
        loading: aiLoading,
      }
    : {
        successful: agentTotals.successful,
        failed: agentTotals.failed,
        sourceLabel: "All time · from agent metrics",
        loading: agentsLoading,
      };

  return (
    <Page width="wide">
      {heading}

      {errors.length > 0 && (
        <Alert
          tone="danger"
          title="Some dashboard data couldn't be loaded"
          description={errors.map((e) => `${e.label}: ${e.message}`).join(" · ")}
          action={
            <Button variant="outline" size="sm" onClick={() => errors.forEach((e) => e.retry())}>
              Try again
            </Button>
          }
        />
      )}

      <StatGroup columns={4} aria-label="Key metrics">
        <Stat
          label="AI requests"
          icon={<Zap />}
          loading={aiAvailable ? aiLoading : statsLoading}
          value={formatNumber(aiAvailable ? summary?.total_calls : s?.total_ai_requests)}
          hint={aiAvailable ? windowHint : "All time"}
          info={
            aiAvailable
              ? `LLM calls for this account in the ${windowHint.toLowerCase()}, all statuses (AI request logs).`
              : "All AI requests ever recorded for this account (analytics totals)."
          }
        />
        <Stat
          label="Success rate"
          icon={<Gauge />}
          loading={aiAvailable ? aiLoading : agentsLoading}
          value={formatPercent(aiAvailable ? summary?.success_rate : fallbackSuccess)}
          hint={aiAvailable ? windowHint : "All time · from agent metrics"}
          info={
            aiAvailable
              ? `Share of LLM calls that succeeded in the ${windowHint.toLowerCase()} (AI request logs).`
              : "Successful answers ÷ (successful + failed answers), summed over all agents, all time."
          }
        />
        <Stat
          label="Avg response time"
          icon={<Clock />}
          loading={aiAvailable ? aiLoading : statsLoading}
          value={formatDurationMs(aiAvailable ? summary?.avg_latency_ms : s?.avg_response_time_ms)}
          hint={aiAvailable ? windowHint : "All time"}
          info={
            aiAvailable
              ? `Average LLM latency per call in the ${windowHint.toLowerCase()}.`
              : "Average AI response time over all requests for this account."
          }
        />
        <Stat
          label="AI cost"
          icon={<Coins />}
          loading={aiAvailable ? aiLoading : statsLoading}
          value={formatMoney(aiAvailable ? summary?.total_cost : s?.total_cost)}
          hint={aiAvailable ? windowHint : "All time"}
          info="Cost of LLM calls in EGP, computed by the server with the configured markup included."
        />
      </StatGroup>

      <StatGroup columns={5} variant="strip" aria-label="All-time totals">
        <Stat emphasis="secondary" label="Sessions" hint="All time" loading={statsLoading} value={formatNumber(s?.total_sessions)} />
        <Stat emphasis="secondary" label="Messages" hint="All time" loading={statsLoading} value={formatNumber(s?.total_messages)} />
        <Stat emphasis="secondary" label="Input tokens" hint="All time" loading={statsLoading} value={formatNumber(s?.total_input_tokens)} />
        <Stat emphasis="secondary" label="Output tokens" hint="All time" loading={statsLoading} value={formatNumber(s?.total_output_tokens)} />
        <Stat
          emphasis="secondary"
          label="Escalations"
          hint="All time · agent metrics"
          loading={agentsLoading}
          value={agentsQuery.isError ? "—" : formatNumber(agentTotals.escalations)}
        />
      </StatGroup>

      <AiActivityCard
        points={timeseries.data ?? []}
        days={days}
        loading={workspaceLoading || timeseries.isLoading}
        error={
          timeseries.isError
            ? {
                icon: AlertCircle,
                title: "Couldn't load AI activity",
                description: formatUserError(timeseries.error),
                action: (
                  <Button variant="outline" size="sm" onClick={() => void timeseries.refetch()}>
                    Try again
                  </Button>
                ),
              }
            : null
        }
      />

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <AnswerOutcomesCard
          successful={outcomes.successful}
          failed={outcomes.failed}
          sourceLabel={outcomes.sourceLabel}
          byModel={ai?.by_model}
          loading={outcomes.loading}
          error={
            !aiAvailable && agentsQuery.isError
              ? { icon: AlertCircle, title: "Couldn't load answer outcomes", description: formatUserError(agentsQuery.error) }
              : null
          }
        />
        {aiAvailable ? (
          <AiCostCard
            sourceLabel={`${windowHint} · AI request logs`}
            cost={summary?.total_cost}
            requests={summary?.total_calls}
            tokens={[{ label: "Tokens", value: summary?.total_tokens }]}
            byModel={ai?.by_model}
            note={ai && ai.by_model.length > 0 ? "Cost isn't broken down per model; bars show each model's share of calls." : undefined}
            loading={aiLoading}
          />
        ) : (
          <AiCostCard
            sourceLabel="All time · analytics totals"
            cost={s?.total_cost}
            requests={s?.total_ai_requests}
            tokens={[
              { label: "Input tokens", value: s?.total_input_tokens },
              { label: "Output tokens", value: s?.total_output_tokens },
            ]}
            note={
              canViewAiMetrics
                ? "Range figures are unavailable right now, so all-time totals are shown."
                : "Range figures and usage by model need access to Logs."
            }
            loading={statsLoading}
            error={
              stats.isError ? { icon: AlertCircle, title: "Couldn't load AI cost", description: formatUserError(stats.error) } : null
            }
          />
        )}
      </div>

      <section className="space-y-3" aria-labelledby="agent-performance-heading">
        <div>
          <h2 id="agent-performance-heading" className="text-base font-semibold text-foreground">
            Agent performance
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            All time, per agent: AI usage, answer outcomes and response time (computed live).
          </p>
        </div>
        <AgentPerformanceTable
          accountId={accountId}
          agents={agents}
          loading={agentsLoading}
          error={agentsQuery.isError ? formatUserError(agentsQuery.error) : null}
          onRetry={() => void agentsQuery.refetch()}
        />
      </section>
    </Page>
  );
}
