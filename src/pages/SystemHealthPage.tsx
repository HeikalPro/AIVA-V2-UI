import { Activity } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { SystemComponentsSection } from "@/components/system/SystemComponentsSection";
import { SystemResourcesSection } from "@/components/system/SystemResourcesSection";

export function SystemHealthPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        title="System Health"
        description="Dependency status and live host resources."
      />

      <SystemComponentsSection />
      <SystemResourcesSection />
    </div>
  );
}
