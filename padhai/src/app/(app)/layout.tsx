import { Sidebar } from '@/components/nav/sidebar';
import { BottomNav } from '@/components/nav/bottom-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-8">{children}</main>
      <BottomNav />
    </div>
  );
}
