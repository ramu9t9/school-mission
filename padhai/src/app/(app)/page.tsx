import Link from 'next/link';
import { getDb } from '@/server/db/client';
import { requireUser } from '@/server/auth/current-user';
import { listKids } from '@/server/kids/kids';
import { listTasks, type TaskType } from '@/server/tasks/tasks';
import { todayISO, timelineBucket, type TimelineBucket } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { HomeFilters } from './home-filters';

const GROUP_ORDER: { key: TimelineBucket; label: string }[] = [
  { key: 'overdue', label: '⚠️ Overdue' },
  { key: 'today', label: '⏰ Today' },
  { key: 'tomorrow', label: '📅 Tomorrow' },
  { key: 'week', label: '🗓️ This week' },
  { key: 'later', label: 'Later' },
  { key: 'none', label: 'No date' },
];

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser();
  const sp = await searchParams;
  const db = getDb();
  const kids = await listKids(db);
  const tasks = await listTasks(db, {
    kidId: sp.kid ? Number(sp.kid) : undefined,
    type: sp.type as TaskType | undefined,
  });
  const today = todayISO();

  const dueToday = tasks.filter((t) => timelineBucket(t.dueDate, today) === 'today').length;
  const exams = tasks.filter((t) => t.type === 'test').length;
  const feesDue = tasks.filter((t) => t.type === 'fee' && (t.paymentStatus === 'unpaid' || t.paymentStatus === 'partial'))
    .reduce((sum, t) => sum + Number(t.amountDue ?? 0), 0);

  const groups = GROUP_ORDER.map((g) => ({ ...g, items: tasks.filter((t) => timelineBucket(t.dueDate, today) === g.key) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Home</h1>
        <Link href="/task/new"><Button size="sm">＋ Add Task</Button></Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 p-3"><div className="text-2xl font-bold text-violet-300">{dueToday}</div><div className="text-xs text-zinc-400">Due today</div></div>
        <div className="rounded-xl border border-white/10 p-3"><div className="text-2xl font-bold text-cyan-300">{exams}</div><div className="text-xs text-zinc-400">Exams</div></div>
        <div className="rounded-xl border border-white/10 p-3"><div className="text-2xl font-bold text-pink-300">₹{feesDue.toLocaleString('en-IN')}</div><div className="text-xs text-zinc-400">Fees due</div></div>
      </div>

      <HomeFilters kids={kids.map((k) => ({ id: k.id, name: k.name }))} kid={sp.kid} type={sp.type} />

      {groups.length === 0 && <p className="text-sm text-zinc-400">No tasks yet. Add one to get started.</p>}
      {groups.map((g) => (
        <section key={g.key} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{g.label}</h2>
          {g.items.map((t) => (
            <Link key={t.id} href={`/task/${t.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-sm"><span className="font-medium">{t.title}</span><span className="text-zinc-500"> · {t.type}</span></span>
              <span className="text-xs text-zinc-400">{t.dueDate ?? ''}{t.priority === 'high' ? ' · 🔴' : ''}</span>
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
