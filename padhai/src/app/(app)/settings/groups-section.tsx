import { revalidatePath } from 'next/cache';
import { getDb } from '@/server/db/client';
import { requireUser } from '@/server/auth/current-user';
import { listKids } from '@/server/kids/kids';
import { addGroup, listGroupsForKid, setGroupActive } from '@/server/groups/groups';
import { Button } from '@/components/ui/button';

async function addGroupAction(formData: FormData) {
  'use server';
  await requireUser();
  const kidId = Number(formData.get('kidId'));
  const groupName = String(formData.get('groupName') ?? '').trim();
  const groupId = String(formData.get('groupId') ?? '').trim() || undefined;
  if (Number.isInteger(kidId) && groupName) {
    await addGroup(getDb(), { kidId, groupName, groupId });
    revalidatePath('/settings');
  }
}

async function removeGroupAction(formData: FormData) {
  'use server';
  await requireUser();
  const id = Number(formData.get('id'));
  if (Number.isInteger(id)) {
    await setGroupActive(getDb(), id, false);
    revalidatePath('/settings');
  }
}

export async function GroupsSection() {
  const db = getDb();
  const kids = await listKids(db);
  const withGroups = await Promise.all(
    kids.map(async (kid) => ({ kid, groups: await listGroupsForKid(db, kid.id) })),
  );

  return (
    <section className="space-y-4 rounded-xl border border-white/10 p-4">
      <h2 className="font-semibold">WhatsApp Groups</h2>
      <p className="text-xs text-zinc-400">
        Group id is preferred for matching incoming WhatsApp messages; group name is used as a display label and fallback when no id is set.
      </p>
      {withGroups.length === 0 && <p className="text-sm text-zinc-400">Add a kid first.</p>}
      {withGroups.map(({ kid, groups }) => (
        <div key={kid.id} className="space-y-2 rounded-lg bg-white/5 p-3">
          <div className="text-sm font-medium">{kid.name}</div>
          <ul className="space-y-1">
            {groups.length === 0 && <li className="text-xs text-zinc-400">No groups linked.</li>}
            {groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between text-sm">
                <span>{g.groupName}{g.groupId ? <span className="text-zinc-500"> · {g.groupId}</span> : null}</span>
                <form action={removeGroupAction}>
                  <input type="hidden" name="id" value={g.id} />
                  <Button type="submit" variant="ghost" size="sm">Remove</Button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addGroupAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="kidId" value={kid.id} />
            <input name="groupName" required placeholder="Group name"
              className="flex-1 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500" />
            <input name="groupId" placeholder="Group id (optional)"
              className="w-44 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500" />
            <Button type="submit" size="sm">Add group</Button>
          </form>
        </div>
      ))}
    </section>
  );
}
