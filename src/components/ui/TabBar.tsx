/**
 * components/ui/TabBar.tsx
 * Animated horizontal tab navigation.
 * Accepts array of { id, label, icon } objects.
 */

"use client";

interface Tab {
  id:    string;
  label: string;
  icon:  string; // emoji or text icon
}

interface TabBarProps {
  tabs:     Tab[];
  active:   string;
  onChange: (id: string) => void;
}

export default function TabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-0 no-scrollbar">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={[
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150",
              isActive
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent",
            ].join(" ")}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
