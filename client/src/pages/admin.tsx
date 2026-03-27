import { useState } from "react";
import Navigation from "@/components/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { DashboardSection } from "@/components/admin/DashboardSection";
import { PublicationsSection } from "@/components/admin/PublicationsSection";
import { DataQualitySection } from "@/components/admin/DataQualitySection";
import { OperationsSection } from "@/components/admin/OperationsSection";
import type { AdminSection } from "@/components/admin/admin-types";

export default function Admin() {
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-black">
      <Navigation />
      <div className="flex">
        <AdminSidebar active={activeSection} onNavigate={setActiveSection} />
        <main className="flex-1 min-w-0 p-6 lg:p-8">
          {activeSection === "dashboard" && <DashboardSection onNavigate={setActiveSection} />}
          {activeSection === "publications" && <PublicationsSection />}
          {activeSection === "data-quality" && <DataQualitySection />}
          {activeSection === "operations" && <OperationsSection />}
        </main>
      </div>
    </div>
  );
}
