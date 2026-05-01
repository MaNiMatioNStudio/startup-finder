"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 shrink-0 bg-gray-950 text-gray-400 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="text-white font-semibold text-sm">Algorithm Trainer</div>
        <div className="text-gray-500 text-xs mt-0.5">X アルゴリズム教育</div>
      </div>

      <nav className="flex-1 px-3 py-4">
        <Link
          href="/training-account"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
            pathname === "/training-account"
              ? "bg-indigo-600 text-white"
              : "hover:bg-gray-800 hover:text-gray-200"
          }`}
        >
          <span className="text-base leading-none">◎</span>
          <span>Training Account</span>
        </Link>
      </nav>
    </aside>
  );
}
