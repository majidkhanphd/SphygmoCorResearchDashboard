import { NAV_ITEMS } from "./admin-utils";
import type { AdminSection } from "./admin-types";

export function AdminSidebar({ active, onNavigate }: { active: AdminSection; onNavigate: (s: AdminSection) => void }) {
  return (
    <aside className="w-14 md:w-[220px] shrink-0 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 min-h-[calc(100vh-57px)] sticky top-[57px]">
      <nav className="flex flex-col gap-1 p-2 md:p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                isActive
                  ? "bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#007AFF]/20 dark:text-[#6cb4ff]"
                  : "text-[#6e6e73] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[#1d1d1f] dark:hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
