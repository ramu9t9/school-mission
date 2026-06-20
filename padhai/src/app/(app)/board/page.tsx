import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/server/db/client';
import { requireUser } from '@/server/auth/current-user';
import { listKids } from '@/server/kids/kids';
import { listTasks, setBoardStatus } from '@/server/tasks/tasks';
import { Button } from '@/components/ui/button';

async function moveAction(formData: FormData) {
  'use server';
  await requireUser();
  const id = Number(formData.get('id'));
  const status = String(formData.get('status')) as 'todo' | 'doing' | 'done';
  if (Number.isInteger(id) && ['todo', 'doing', 'done'].includes(status)) {
    await setBoardStatus(getDb(), id, status);
    revalidatePath('/board');
  }
}

const COLUMNS: { key: 'todo' | 'doing' | 'done'; label: string; next?: 'doing' | 'done'; prev?: 'todo' | 'doing' }[] = [
  { key: 'todo', label: 'To Do', next: 'doing' },
  { key: 'doing', label: 'Doing', next: 'done', prev: 'todo' },
  { key: 'done', label: 'Done', prev: 'doing' },
];

export default async function BoardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser();
  const sp = await searchParams;
  const db = getDb();
  const kids = await listKids(db);
  const kidId = sp.kid ? Number(sp.kid) : undefined;
  const tasks = await listTasks(db, { kidId });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Board</h1>
      <div className="flex flex-wrap gap-2">
        <Link href="/board" className={`rounded-full border px-3 py-1 text-xs ${!kidId ? 'border-violet-500 text-violet-200' : 'border-white/10 text-zinc-400'}`}>All kids</Link>
        {kids.map((k) => (
          <Link key={k.id} href={`/board?kid=${k.id}`} className={`rounded-full border px-3 py-1 text-xs ${kidId === k.id ? 'border-violet-500 text-violet-200' : 'border-white/10 text-zinc-400'}`}>{k.name}</Link>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.boardStatus === col.key);
          return (
            <div key={col.key} className="space-y-2 rounded-xl border border-white/10 p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{col.label} ({items.length})</h2>
              {items.map((t) => (
                <div key={t.id} className="rounded-lg bg-white/5 p-2">
                  <Link href={`/task/${t.id}`} className="text-sm font-medium">{t.title}</Link>
                  <div className="mt-1 flex gap-1">
                    {col.prev && (
                      <form action={moveAction}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value={col.prev} /><Button type="submit" variant="ghost" size="sm">←</Button></form>
                    )}
                    {col.next && (
                      <form action={moveAction}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value={col.next} /><Button type="submit" variant="ghost" size="sm">→</Button></form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
