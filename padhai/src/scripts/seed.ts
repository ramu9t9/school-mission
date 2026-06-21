import { getDb } from '../server/db/client';
import { getUserByEmail, createUserAccount } from '../server/auth/users';
import { createKid } from '../server/kids/kids';
import { addGroup } from '../server/groups/groups';
import { createManualTask } from '../server/tasks/tasks';

async function main() {
  const db = getDb();

  let user = await getUserByEmail(db, 'demo@padhai.app');
  if (!user) user = await createUserAccount(db, { name: 'Demo Parent', email: 'demo@padhai.app', password: 'demo-password' });

  const aarav = await createKid(db, { name: 'Aarav', grade: '5', section: 'B' });
  const diya = await createKid(db, { name: 'Diya', grade: '3', section: 'A' });

  await addGroup(db, { kidId: aarav.id, groupName: 'Class 5B Parents' });
  await addGroup(db, { kidId: diya.id, groupName: 'Class 3A Official' });

  const tasks = [
    { kidId: aarav.id, type: 'homework' as const, title: 'Maths exercise 5.2 Q1–10', priority: 'medium' as const, dueDate: isoIn(1) },
    { kidId: aarav.id, type: 'test' as const, title: 'Science unit test — Ch. 4 & 5', priority: 'high' as const, dueDate: isoIn(0) },
    { kidId: diya.id, type: 'homework' as const, title: 'English worksheet pages 12–14', priority: 'medium' as const, dueDate: isoIn(0) },
    { kidId: aarav.id, type: 'competition' as const, title: 'Inter-school Olympiad — register', priority: 'high' as const, dueDate: isoIn(4) },
    { kidId: diya.id, type: 'fee' as const, title: 'Term fee', amountDue: 4500, paymentDueDate: isoIn(5) },
    { kidId: diya.id, type: 'notice' as const, title: 'PTM on Saturday', priority: 'low' as const, dueDate: isoIn(6) },
  ];
  const created = [];
  for (const t of tasks) created.push(await createManualTask(db, user.id, t));

  // Mark one as done so the Board has a Done column populated.
  const { setBoardStatus } = await import('../server/tasks/tasks');
  await setBoardStatus(db, created[2].id, 'done');

  console.log(`Seeded: user #${user.id}, kids #${aarav.id}/#${diya.id}, ${created.length} tasks.`);
  process.exit(0);
}

function isoIn(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

main().catch((err) => { console.error('Seed failed:', err instanceof Error ? err.message : err); process.exit(1); });
