"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const nav = [
  { href: "/", label: "Dashboard", icon: "◈" },
  { href: "/personas", label: "Persona Prompts", icon: "✦" },
  { href: "/candidates", label: "Candidates", icon: "◉" },
  { href: "/scoring", label: "Scoring", icon: "★" },
  { href: "/evolution", label: "Evolution", icon: "⟳" },
  { href: "/history", label: "History", icon: "◷" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [devAlertCount, setDevAlertCount] = useState(0);

  useEffect(() => {
    fetch("/api/dev-alerts")
      .then((r) => r.json())
      .then((data: unknown[]) => setDevAlertCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});
  }, [pathname]); // ページ遷移のたびに更新

  return (
    <aside className="w-52 shrink-0 bg-gray-950 text-gray-400 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="text-white font-semibold text-sm">Startup Finder</div>
        <div className="text-gray-500 text-xs mt-0.5">Prompt-driven discovery</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map((item) => {
          const active = pathname === item.href;
          const showBadge = item.href === "/evolution" && devAlertCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                active
                  ? "bg-indigo-600 text-white"
                  : "hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {devAlertCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
