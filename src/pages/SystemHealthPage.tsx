import { Activity } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { SystemResourcesSection } from "@/components/system/SystemResourcesSection";

export function SystemHealthPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        title="System Health"
        description="Live host and backend-process resources — refreshes every 5s."
      />

      <SystemResourcesSection />
    </div>
  );
}
