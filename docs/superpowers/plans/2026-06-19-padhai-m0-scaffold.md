# PadhAI — M0 Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the PadhAI Next.js application skeleton — TypeScript + Tailwind + shadcn/ui, a working Vitest test runner, a validated environment module, a health-check endpoint, and the mobile-first navigation shell (bottom tabs on phone, sidebar on desktop) — so every later milestone has a tested foundation to build on.

**Architecture:** One Next.js App Router app lives in `padhai/` at the repo root. All server/business logic will live under `padhai/src/server/` (added in later milestones); M0 only creates `padhai/src/lib/` (pure helpers), the app shell under `padhai/src/app/`, and presentational nav components under `padhai/src/components/`. Tests sit next to the code they cover as `*.test.ts(x)` and run under Vitest. M0 introduces no database, no auth, no AI — just a booting, navigable, tested shell.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui · Vitest 4 · @testing-library/react · zod 4 · Node ≥ 20 (dev machine has Node 24).

## Global Constraints

- **App root:** all code for the rebuild lives in `padhai/` — never touch the gitignored legacy `digital-scout/` prototype.
- **Single git repo:** the repo is already initialized at `g:\Projects\School Mission` on branch `main`; do NOT create a nested git repo inside `padhai/` (delete `padhai/.git` if a scaffolder creates one).
- **Single-tenant:** one family; no `family_id` anywhere, no multi-tenant abstractions.
- **Mobile-first:** UI is designed for phones first; desktop is the enhancement. Bottom nav on mobile, left sidebar on desktop.
- **Navigation is exactly four destinations:** `Home` (`/`), `Board` (`/board`), `Review` (`/review`), `Settings` (`/settings`).
- **Secrets:** never commit real secrets; `.env` is gitignored; only `.env.example` with placeholders is committed.
- **Language/runtime:** TypeScript, ES modules, `@/*` path alias maps to `padhai/src/*`.
- **TDD:** for any file containing logic (env parsing, health handler, nav config), write the failing test first. Purely presentational components may be verified by the dev server rather than a render test.
- **Commits:** small and frequent; one commit per task. Do not sign commits. End commit messages with the `Co-Authored-By` trailer below.
- **Commit trailer (every commit):**
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- **Do not push** to GitHub unless the user explicitly asks.

---

## File Structure (created across M0)

```
padhai/
├── package.json                         # scripts + deps
├── tsconfig.json                        # @/* -> src/*
├── next.config.ts
├── postcss.config.mjs                   # @tailwindcss/postcss
├── eslint.config.mjs
├── vitest.config.ts                     # jsdom env + @/* alias
├── vitest.setup.ts                      # @testing-library/jest-dom
├── components.json                      # shadcn/ui config
├── .env.example                         # safe placeholders
├── .gitignore                           # (Next's own; repo root .gitignore already covers it)
└── src/
    ├── app/
    │   ├── layout.tsx                    # root <html>/<body>, fonts, globals.css
    │   ├── globals.css                   # Tailwind v4 entry + theme tokens
    │   ├── (app)/
    │   │   ├── layout.tsx                # AppShell: sidebar (desktop) + bottom nav (mobile)
    │   │   ├── page.tsx                  # Home placeholder
    │   │   ├── board/page.tsx            # Board placeholder
    │   │   ├── review/page.tsx           # Review placeholder
    │   │   └── settings/page.tsx         # Settings placeholder
    │   └── api/
    │       └── health/route.ts           # GET /api/health
    ├── components/
    │   ├── ui/                            # shadcn primitives (button, …)
    │   └── nav/
    │       ├── nav-items.ts               # NAV_ITEMS config (pure data)
    │       ├── nav-items.test.ts
    │       ├── bottom-nav.tsx             # mobile bottom tab bar
    │       └── sidebar.tsx                # desktop left sidebar
    └── lib/
        ├── utils.ts                       # shadcn cn() helper
        ├── env.ts                         # zod-validated environment
        ├── env.test.ts
        └── health.ts                      # buildHealth() pure helper
            (health.test.ts)
```

---

## Task 1: Scaffold the Next.js app

**Files:**
- Create: `padhai/` (entire Next.js scaffold via `create-next-app`)
- Modify: none (repo-root `.gitignore` already ignores `.next/`, `node_modules/`, `.env`)

**Interfaces:**
- Consumes: nothing.
- Produces: a booting Next.js app at `padhai/` with `npm run dev`, `npm run build`, `npm run lint`; path alias `@/*` → `padhai/src/*`; Tailwind v4 wired through `postcss.config.mjs` + `src/app/globals.css`.

- [ ] **Step 1: Scaffold with create-next-app**

Run from the repo root `g:\Projects\School Mission`:

```bash
npx create-next-app@latest padhai \
  --ts --tailwind --eslint --app --src-dir \
  --use-npm --import-alias "@/*" --turbopack --yes
```

Expected: a new `padhai/` directory containing `package.json`, `src/app/`, `tailwind`-wired `globals.css`, `postcss.config.mjs`, `tsconfig.json`.

- [ ] **Step 2: Remove the nested git repo create-next-app creates**

create-next-app runs `git init` inside `padhai/`. We use the single repo at the root, so delete it:

```bash
rm -rf "padhai/.git"
```

Verify there is exactly one repo:

```bash
git -C "g:/Projects/School Mission" rev-parse --show-toplevel
# Expected: g:/Projects/School Mission   (NOT .../padhai)
test ! -e "padhai/.git" && echo "no nested repo: OK"
```

- [ ] **Step 3: Verify the dev server boots, then stop it**

```bash
cd padhai && npm run build
```

Expected: `✓ Compiled successfully` and a route table listing `/`. (We use `build` rather than `dev` because it exits on its own and proves the toolchain compiles.)

- [ ] **Step 4: Pin Node engine and confirm scripts**

Edit `padhai/package.json` to add an `engines` field (leave the create-next-app `scripts` as-is). The `scripts` block must contain at least `dev`, `build`, `start`, `lint`. Add `engines`:

```json
  "engines": {
    "node": ">=20.0.0"
  }
```

- [ ] **Step 5: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai
git commit -m "$(printf 'chore(m0): scaffold padhai Next.js app\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: Wire up Vitest and prove the runner

**Files:**
- Create: `padhai/vitest.config.ts`, `padhai/vitest.setup.ts`
- Create: `padhai/src/lib/smoke.test.ts` (temporary proof; deleted at end of task)
- Modify: `padhai/package.json` (add dev deps + `test` scripts)

**Interfaces:**
- Consumes: the scaffold from Task 1.
- Produces: `npm test` (single run) and `npm run test:watch`; a jsdom test environment with `@/*` alias resolution and `@testing-library/jest-dom` matchers available in every test.

- [ ] **Step 1: Install test dependencies**

```bash
cd padhai
npm install -D vitest@4 @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event vite-tsconfig-paths
```

- [ ] **Step 2: Create the Vitest config**

Create `padhai/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
```

Create `padhai/vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Add test scripts**

In `padhai/package.json`, add to `scripts`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 4: Write a temporary smoke test**

Create `padhai/src/lib/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest runner', () => {
  it('runs and asserts', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the test suite to prove the runner works**

```bash
cd padhai && npm test
```

Expected: `1 passed (1)` — Vitest discovers and runs the smoke test.

- [ ] **Step 6: Delete the temporary smoke test**

```bash
rm "padhai/src/lib/smoke.test.ts"
```

- [ ] **Step 7: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/vitest.config.ts padhai/vitest.setup.ts padhai/package.json padhai/package-lock.json
git commit -m "$(printf 'chore(m0): add vitest test runner\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: Environment validation module (TDD)

**Files:**
- Create: `padhai/src/lib/env.ts`, `padhai/src/lib/env.test.ts`
- Create: `padhai/.env.example`
- Modify: `padhai/package.json` (add `zod`)

**Interfaces:**
- Consumes: Vitest from Task 2.
- Produces:
  - `parseEnv(source: Record<string, string | undefined>): Env` — validates a raw env object, throws an `Error` whose message lists invalid keys when validation fails.
  - `env: Env` — the validated environment parsed from `process.env`, for app code to import.
  - `type Env = { NODE_ENV: 'development' | 'production' | 'test'; APP_URL: string }`.

  Later milestones EXTEND `envSchema` with `DATABASE_URL`, `SESSION_SECRET`, `WEBHOOK_SECRET`, `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. M0 only defines `NODE_ENV` and `APP_URL` so the pattern exists and is tested.

- [ ] **Step 1: Install zod**

```bash
cd padhai && npm install zod@4
```

- [ ] **Step 2: Write the failing test**

Create `padhai/src/lib/env.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('accepts a valid environment and applies defaults', () => {
    const env = parseEnv({ NODE_ENV: 'production', APP_URL: 'https://padhai.app' });
    expect(env.NODE_ENV).toBe('production');
    expect(env.APP_URL).toBe('https://padhai.app');
  });

  it('defaults NODE_ENV to development and APP_URL to localhost when unset', () => {
    const env = parseEnv({});
    expect(env.NODE_ENV).toBe('development');
    expect(env.APP_URL).toBe('http://localhost:3000');
  });

  it('throws listing the offending key when NODE_ENV is invalid', () => {
    expect(() => parseEnv({ NODE_ENV: 'staging' })).toThrowError(/NODE_ENV/);
  });

  it('throws when APP_URL is not a valid URL', () => {
    expect(() => parseEnv({ APP_URL: 'not-a-url' })).toThrowError(/APP_URL/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd padhai && npm test -- src/lib/env.test.ts
```

Expected: FAIL — `Failed to resolve import "./env"` (the module does not exist yet).

- [ ] **Step 4: Write the minimal implementation**

Create `padhai/src/lib/env.ts`:

```ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const keys = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid environment variables: ${keys}`);
  }
  return result.data;
}

export const env: Env = parseEnv(process.env);
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd padhai && npm test -- src/lib/env.test.ts
```

Expected: PASS — `4 passed (4)`.

- [ ] **Step 6: Create the env example file**

Create `padhai/.env.example` (placeholders only — never real values):

```dotenv
# Runtime
NODE_ENV=development
# Public base URL of the dashboard
APP_URL=http://localhost:3000

# ── Added in later milestones (left here as a forward reference) ──
# DATABASE_URL=postgres://padhai:CHANGE_ME@127.0.0.1:5432/padhai
# SESSION_SECRET=generate_with_openssl_rand_hex_32
# WEBHOOK_SECRET=generate_with_openssl_rand_hex_32
# OPENROUTER_API_KEY=sk-or-your-key-here
# TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
# TELEGRAM_CHAT_ID=your_personal_telegram_chat_id
```

- [ ] **Step 7: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/lib/env.ts padhai/src/lib/env.test.ts padhai/.env.example padhai/package.json padhai/package-lock.json
git commit -m "$(printf 'feat(m0): add validated environment module\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: Health-check endpoint (TDD)

**Files:**
- Create: `padhai/src/lib/health.ts`, `padhai/src/lib/health.test.ts`
- Create: `padhai/src/app/api/health/route.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure helper).
- Produces:
  - `buildHealth(now?: Date): { status: 'ok'; service: 'padhai'; timestamp: string }` — pure function returning the health payload; `timestamp` is ISO-8601.
  - `GET()` route handler at `/api/health` returning that payload as JSON with HTTP 200.

- [ ] **Step 1: Write the failing test for the pure helper**

Create `padhai/src/lib/health.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildHealth } from './health';

describe('buildHealth', () => {
  it('reports ok status for the padhai service', () => {
    const result = buildHealth(new Date('2026-06-19T03:30:00.000Z'));
    expect(result.status).toBe('ok');
    expect(result.service).toBe('padhai');
    expect(result.timestamp).toBe('2026-06-19T03:30:00.000Z');
  });

  it('uses the current time when no date is given', () => {
    const before = Date.now();
    const result = buildHealth();
    const ts = new Date(result.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd padhai && npm test -- src/lib/health.test.ts
```

Expected: FAIL — `Failed to resolve import "./health"`.

- [ ] **Step 3: Write the minimal helper**

Create `padhai/src/lib/health.ts`:

```ts
export interface Health {
  status: 'ok';
  service: 'padhai';
  timestamp: string;
}

export function buildHealth(now: Date = new Date()): Health {
  return {
    status: 'ok',
    service: 'padhai',
    timestamp: now.toISOString(),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd padhai && npm test -- src/lib/health.test.ts
```

Expected: PASS — `2 passed (2)`.

- [ ] **Step 5: Write the route handler**

Create `padhai/src/app/api/health/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { buildHealth } from '@/lib/health';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(buildHealth());
}
```

- [ ] **Step 6: Verify the endpoint responds against a built server**

```bash
cd padhai && npm run build && (npm run start & echo $! > /tmp/padhai_srv.pid; sleep 4; \
  curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health; echo; \
  curl -s http://localhost:3000/api/health; echo; \
  kill "$(cat /tmp/padhai_srv.pid)")
```

Expected: `200` followed by JSON like `{"status":"ok","service":"padhai","timestamp":"..."}`.

- [ ] **Step 7: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/lib/health.ts padhai/src/lib/health.test.ts padhai/src/app/api/health/route.ts
git commit -m "$(printf 'feat(m0): add /api/health endpoint\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: Navigation config + app shell (TDD on config)

**Files:**
- Create: `padhai/src/components/nav/nav-items.ts`, `padhai/src/components/nav/nav-items.test.ts`
- Create: `padhai/src/components/nav/bottom-nav.tsx`, `padhai/src/components/nav/sidebar.tsx`
- Create: `padhai/src/app/(app)/layout.tsx`, `padhai/src/app/(app)/page.tsx`, `padhai/src/app/(app)/board/page.tsx`, `padhai/src/app/(app)/review/page.tsx`, `padhai/src/app/(app)/settings/page.tsx`
- Modify: `padhai/src/app/page.tsx` (DELETE — replaced by the `(app)` group home), `padhai/src/app/globals.css` (only if Task 6 not yet run; shadcn handled in Task 6)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `NAV_ITEMS: readonly NavItem[]` where `type NavItem = { href: string; label: string }`, in exact order: Home `/`, Board `/board`, Review `/review`, Settings `/settings`.
  - `<BottomNav />` (mobile, `md:hidden`) and `<Sidebar />` (desktop, `hidden md:flex`) rendering `NAV_ITEMS`, each highlighting the active route via `usePathname()`.
  - The `(app)` route group layout wrapping all four pages with the shell.

- [ ] **Step 1: Write the failing test for the nav config**

Create `padhai/src/components/nav/nav-items.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from './nav-items';

describe('NAV_ITEMS', () => {
  it('has exactly the four destinations in order', () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      'Home',
      'Board',
      'Review',
      'Settings',
    ]);
  });

  it('maps each label to the correct route', () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual([
      '/',
      '/board',
      '/review',
      '/settings',
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd padhai && npm test -- src/components/nav/nav-items.test.ts
```

Expected: FAIL — `Failed to resolve import "./nav-items"`.

- [ ] **Step 3: Write the nav config**

Create `padhai/src/components/nav/nav-items.ts`:

```ts
export interface NavItem {
  href: string;
  label: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/board', label: 'Board' },
  { href: '/review', label: 'Review' },
  { href: '/settings', label: 'Settings' },
] as const;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd padhai && npm test -- src/components/nav/nav-items.test.ts
```

Expected: PASS — `2 passed (2)`.

- [ ] **Step 5: Write the BottomNav component (mobile)**

Create `padhai/src/components/nav/bottom-nav.tsx`:

```tsx
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
```

- [ ] **Step 6: Write the Sidebar component (desktop)**

Create `padhai/src/components/nav/sidebar.tsx`:

```tsx
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
```

- [ ] **Step 7: Write the (app) shell layout**

Create `padhai/src/app/(app)/layout.tsx`:

```tsx
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
```

- [ ] **Step 8: Create the four placeholder pages and remove the default page**

Create `padhai/src/app/(app)/page.tsx`:

```tsx
export default function HomePage() {
  return <h1 className="text-2xl font-bold">Home</h1>;
}
```

Create `padhai/src/app/(app)/board/page.tsx`:

```tsx
export default function BoardPage() {
  return <h1 className="text-2xl font-bold">Board</h1>;
}
```

Create `padhai/src/app/(app)/review/page.tsx`:

```tsx
export default function ReviewPage() {
  return <h1 className="text-2xl font-bold">Review</h1>;
}
```

Create `padhai/src/app/(app)/settings/page.tsx`:

```tsx
export default function SettingsPage() {
  return <h1 className="text-2xl font-bold">Settings</h1>;
}
```

Delete the scaffolder's default home page so the `(app)` group owns `/`:

```bash
rm "padhai/src/app/page.tsx"
```

- [ ] **Step 9: Verify the full suite passes and the app builds**

```bash
cd padhai && npm test && npm run build
```

Expected: all tests pass (env: 4, health: 2, nav: 2) and `✓ Compiled successfully` with routes `/`, `/board`, `/review`, `/settings`, `/api/health` listed.

- [ ] **Step 10: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/src/components/nav padhai/src/app
git rm --cached padhai/src/app/page.tsx 2>/dev/null || true
git commit -m "$(printf 'feat(m0): add navigation shell and placeholder pages\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 6: Initialize shadcn/ui and confirm the design system entrypoint

**Files:**
- Create: `padhai/components.json`, `padhai/src/lib/utils.ts`, `padhai/src/components/ui/button.tsx`
- Modify: `padhai/src/app/globals.css` (shadcn appends theme tokens), `padhai/src/app/(app)/page.tsx` (render a Button to prove wiring)

**Interfaces:**
- Consumes: the app shell from Task 5.
- Produces: shadcn/ui installed with the `cn()` helper at `@/lib/utils`, a `Button` primitive at `@/components/ui/button`, and design tokens in `globals.css` — the styling foundation every later screen reuses.

- [ ] **Step 1: Initialize shadcn/ui**

```bash
cd padhai && npx shadcn@latest init --base-color zinc --yes
```

Expected: creates `components.json`, `src/lib/utils.ts` (with `cn()`), and updates `globals.css` with theme variables. If prompted despite `--yes`, accept defaults (style: default, base color: zinc, CSS variables: yes).

- [ ] **Step 2: Add the Button primitive**

```bash
cd padhai && npx shadcn@latest add button --yes
```

Expected: creates `src/components/ui/button.tsx`.

- [ ] **Step 3: Render a Button on Home to prove the wiring**

Replace `padhai/src/app/(app)/page.tsx` with:

```tsx
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Home</h1>
      <Button>Add Task</Button>
    </div>
  );
}
```

- [ ] **Step 4: Verify tests still pass and the app builds**

```bash
cd padhai && npm test && npm run build
```

Expected: tests still pass (8 total) and `✓ Compiled successfully`.

- [ ] **Step 5: Manual visual check (acceptance for the presentational shell)**

```bash
cd padhai && npm run dev
```

Open `http://localhost:3000` and confirm:
- On a narrow window (<768px): a **bottom tab bar** shows Home · Board · Review · Settings; the active tab is highlighted; a styled "Add Task" button renders.
- On a wide window (≥768px): a **left sidebar** with the PadhAI wordmark and the four links; no bottom bar.
- Clicking each tab navigates and updates the active highlight.

Stop the server with Ctrl-C when done.

- [ ] **Step 6: Commit**

```bash
cd "g:/Projects/School Mission"
git add padhai/components.json padhai/src/lib/utils.ts padhai/src/components/ui padhai/src/app/globals.css padhai/src/app/(app)/page.tsx padhai/package.json padhai/package-lock.json
git commit -m "$(printf 'feat(m0): initialize shadcn/ui design system\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## M0 Acceptance Criteria (Definition of Done)

- [ ] `cd padhai && npm test` → all suites pass (env 4, health 2, nav 2 = 8 tests).
- [ ] `cd padhai && npm run build` → compiles; route table lists `/`, `/board`, `/review`, `/settings`, `/api/health`.
- [ ] `GET /api/health` returns HTTP 200 with `{"status":"ok","service":"padhai","timestamp":"<ISO>"}`.
- [ ] Mobile viewport shows the bottom tab bar; desktop shows the sidebar; active route is highlighted; navigation works.
- [ ] `parseEnv` rejects an invalid `NODE_ENV`/`APP_URL` with a message naming the bad key.
- [ ] No nested git repo in `padhai/`; `.env` is not tracked; only `.env.example` (placeholders) is committed.
- [ ] Six task commits exist on `main`; nothing pushed.

---

## Self-Review Notes

- **Spec coverage (M0 slice):** scaffold (Next.js TS + Tailwind + shadcn) ✓ Tasks 1, 6; Vitest ✓ Task 2; env validation ✓ Task 3; `/health` ✓ Task 4; base layout + mobile-first nav (bottom nav / sidebar) ✓ Task 5. Database, auth, AI, reminders are explicitly **out of M0** and handled in M1–M9.
- **Placeholder scan:** no TBD/TODO; every code step shows complete code; every command lists expected output.
- **Type consistency:** `NavItem { href, label }`, `Env { NODE_ENV, APP_URL }`, `buildHealth(now?) -> { status, service, timestamp }`, `parseEnv(source) -> Env` are used identically wherever referenced.
- **Forward references:** `env.ts` is explicitly noted as extended in later milestones; `src/server/` is reserved (not created in M0) to avoid empty-dir churn.
