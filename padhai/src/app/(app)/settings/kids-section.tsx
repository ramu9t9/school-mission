import { revalidatePath } from 'next/cache';
import { getDb } from '@/server/db/client';
import { requireUser } from '@/server/auth/current-user';
import { createKid, listKids, setKidActive } from '@/server/kids/kids';
import { Button } from '@/components/ui/button';

async function addKid(formData: FormData) {
  'use server';
  await requireUser();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  await createKid(getDb(), {
    name,
    grade: String(formData.get('grade') ?? '') || undefined,
    section: String(formData.get('section') ?? '') || undefined,
  });
  revalidatePath('/settings');
}

async function deactivateKid(formData: FormData) {
  'use server';
  await requireUser();
  const id = Number(formData.get('id'));
  if (Number.isInteger(id)) {
    await setKidActive(getDb(), id, false);
    revalidatePath('/settings');
  }
}

export async function KidsSection() {
  const kids = await listKids(getDb());
  return (
    <section className="space-y-3 rounded-xl border border-white/10 p-4">
      <h2 className="font-semibold">Kids</h2>
      <ul className="space-y-2">
        {kids.length === 0 && <li className="text-sm text-zinc-400">No kids yet.</li>}
        {kids.map((kid) => (
          <li key={kid.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
            <span className="text-sm">
              <span className="font-medium">{kid.name}</span>
              {kid.grade && <span className="text-zinc-400"> · Grade {kid.grade}{kid.section ? `-${kid.section}` : ''}</span>}
            </span>
            <form action={deactivateKid}>
              <input type="hidden" name="id" value={kid.id} />
              <Button type="submit" variant="ghost" size="sm">Remove</Button>
            </form>
          </li>
        ))}
      </ul>
      <form action={addKid} className="flex flex-wrap gap-2">
        <input name="name" required placeholder="Name"
          className="flex-1 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500" />
        <input name="grade" placeholder="Grade"
          className="w-24 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500" />
        <input name="section" placeholder="Section"
          className="w-24 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500" />
        <Button type="submit" size="sm">Add kid</Button>
      </form>
    </section>
  );
}
