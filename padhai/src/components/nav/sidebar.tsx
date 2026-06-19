'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './nav-items';

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-white/10 bg-zinc-950/60 p-4 md:flex">
      <div className="mb-6 px-2 text-lg font-extrabold tracking-tight">
        Padh<span className="text-violet-400">AI</span>
      </div>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              active ? 'bg-violet-500/15 text-violet-300' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
