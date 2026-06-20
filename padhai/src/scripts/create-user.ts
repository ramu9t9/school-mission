import { parseArgs } from 'node:util';
import { getDb } from '../server/db/client';
import { createUserAccount } from '../server/auth/users';

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      email: { type: 'string' },
      password: { type: 'string' },
    },
  });
  if (!values.name || !values.email || !values.password) {
    console.error('Usage: tsx src/scripts/create-user.ts --name "Ram" --email ram@example.com --password "<min 8 chars>"');
    process.exit(1);
  }
  const db = getDb();
  const user = await createUserAccount(db, {
    name: values.name,
    email: values.email,
    password: values.password,
  });
  console.log(`Created user #${user.id}: ${user.name} <${user.email}>`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to create user:', err instanceof Error ? err.message : err);
  process.exit(1);
});
