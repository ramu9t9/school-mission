'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './nav-items';

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-white/10 bg-zinc-950/90 backdrop-blur md:hidden">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs ${
              active ? 'text-violet-400' : 'text-zinc-400'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
