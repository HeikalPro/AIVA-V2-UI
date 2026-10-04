import { useAiTimeseries } from "@/hooks/useAnalytics";
import { AiActivityCard } from "./AiActivityCard";

/**
 * Legacy entry point (30-day AI activity for an account). The dashboard now renders
 * `AiActivityCard` directly with the page's range; kept for any other caller.
 */
export function OverviewCharts({ accountId, days = 30 }: { accountId: number | null; days?: number }) {
  const { data = [], isLoading } = useAiTimeseries(accountId, days, accountId != null);
  return <AiActivityCard points={data} days={days} loading={isLoading} />;
}
