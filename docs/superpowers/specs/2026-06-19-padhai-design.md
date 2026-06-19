# PadhAI — Design Specification

> **Status:** Approved (Sections 1–8) · **Date:** 2026-06-19 · **Author:** brainstormed with Claude
> **Next step:** writing-plans → implementation plan

**PadhAI** is a private, single-family web dashboard that automatically turns a family's school WhatsApp group activity — text, images of circulars, and PDF timetables — into reviewable, trackable tasks (homework, tests, timetable, competitions, events, fees, notices). AI proposes; the parent approves. Self-hosted on the family's own VPS.

The name is a pun: *padhai* (पढ़ाई) = "study" in Hindi, containing **AI**. Tagline: *"Your kids' padhai, on autopilot."*

---

## 1. Scope & Product Direction

PadhAI is a **private single-family** product. Deliberately **not** a SaaS.

**In scope (v1):**
- One family account; logins for two parents (you + spouse), equal full access.
- Simple email/password login.
- Mobile-first responsive dashboard (parents mostly use phones); desktop gets a sidebar.
- Track: **homework & assignments · exams & tests · timetable & schedule · competitions & events · fees · notices**.
- Inputs: WhatsApp **text**, **images**, and **PDFs** become structured tasks.
- AI (Gemini 2.5 Flash via OpenRouter) extracts task details from text, images, and PDFs.
- Reminders via **Telegram (primary) · WhatsApp-back (secondary) · in-app (always-safe fallback)**.
- **Core rule:** every AI-extracted task carries a **confidence score** and lands in a **Review Inbox** for parent confirm/edit/reject/merge before becoming final. School circulars/photos can be unclear, so nothing is final without (optional) review.

**Out of scope (v1, YAGNI):**
- No multi-family / SaaS, no billing, no public signup.
- No native mobile app, no email channel.
- No embeddings-based duplicate detection (v1 uses a simple heuristic behind a replaceable function).
- No automatic data-retention purging (settings stubs only).
- No role-based permissions (both users are equal `parent`).

---

## 2. Tech Stack & Architecture

**Stack:**
- **App:** one **Next.js** app (App Router, **TypeScript**) — pages, dashboard, API route handlers, server actions, auth.
- **UI:** **Tailwind CSS + shadcn/ui + Framer Motion**, mobile-first.
- **Database:** **Postgres + Drizzle ORM**.
- **Media storage:** local disk at **`/var/padhai/media`**; DB stores only file path + metadata. Behind a **storage adapter** so S3-compatible storage can be added later.
- **Background worker:** a **separate Node process** in the same repo, draining a **Postgres-backed job queue** with `FOR UPDATE SKIP LOCKED`. **No Redis** in v1.
- **AI:** **Gemini 2.5 Flash (vision)** via **OpenRouter**.
- **Auth:** email/password, httpOnly session cookie.
- **Deploy:** **PM2** (web + worker) behind **Nginx** + **Let's Encrypt** SSL on the VPS.

**Data flow:**
1. School WhatsApp group → **OpenClaw/Baileys gateway** (same VPS) downloads any media and POSTs text + files to PadhAI's webhook with a shared secret.
2. **Webhook** verifies the secret, stores the raw message + media, enqueues a Postgres job.
3. **Worker** picks up the job → sends text/image/PDF to **Gemini 2.5 Flash** → gets a structured **array of draft tasks**, each with a **confidence score**.
4. Drafts land in the **Review Inbox** (`review_status = pending`). Parent confirms / edits / rejects / merges. Optional auto-confirm above a configurable threshold (default off).
5. Confirmed tasks appear on the **Dashboard** (summary hub + timeline + Kanban + calendar, per-kid + type filters).
6. Worker also runs **reminders** → Telegram + WhatsApp-back + in-app.

**Component boundaries** (each independently testable):
`server/auth`, `server/db`, `server/ai`, `server/queue`, `server/reminders`, `server/tasks`, `server/storage`, `server/whatsapp`, `server/telegram`.

---

## 3. Database Schema & Core Data Model

Single-tenant (one family) → **no `family_id` columns** anywhere.

### users
`id` · `name` · `email` (unique) · `password_hash` · `role` (`parent`) · `last_login` · `created_at`

### sessions
`id` (SHA-256 hash of the cookie token) · `user_id` → users · `expires_at` · `created_at`

### kids
`id` · `name` · `grade` · `section` · `school_name` · `avatar_color` · `active` (bool) · `created_at`

### watched_groups
`id` · `kid_id` → kids · **`group_id`** (WhatsApp group id, used for matching — names can change) · **`group_name`** (display) · `active` · `created_at`

### raw_messages
`id` · `source` (`whatsapp|manual`) · **`group_id`** · `group_name` · `sender` · `body` (text, nullable for media-only) · `content_hash` (sha256 over group+sender+body+media, unique — dedup) · **`processing_status`** (`pending|classified|unmatched|chatter|failed`) · `received_at` · `created_at`

### media_assets
`id` · `raw_message_id` → raw_messages · `kind` (`image|pdf|other`) · `file_path` (under `/var/padhai/media`) · `mime_type` · `size_bytes` · `original_filename` · `created_at`

### tasks ★ (the heart — two independent state dimensions)
- `id` · `kid_id` → kids
- `type` enum: `homework|test|timetable|competition|event|fee|notice|other`
- `subject` · `title` · `description` · `due_date` (date, nullable) · `due_time` (time, nullable)
- `priority` enum: `high|medium|low`
- **`review_status`** enum: `pending|confirmed|auto_confirmed|rejected|merged`
- **`board_status`** enum: `todo|doing|done`
- `confidence` (real 0–1, per task) · `source` enum: `ai|manual|imported` · `ai_model`
- `ai_extracted_json` (jsonb — raw AI output incl. short parent-friendly `reason`; audit/edit)
- `raw_message_id` → raw_messages (nullable; origin for source preview)
- `possible_duplicate_id` → tasks (nullable; set at creation by the duplicate detector)
- `merged_into_id` → tasks (nullable; set when merged)
- **Fee fields:** `amount_due` (numeric, nullable) · `currency` (text, default `INR`) · `payment_status` enum: `unpaid|paid|partial|not_applicable` (default `not_applicable`; fee tasks default `unpaid`) · `payment_due_date` (date, nullable)
- **Reminder fields:** `reminder_at` (timestamptz, nullable) · `reminder_status` enum: `none|scheduled|sent|failed|snoozed`
- `confirmed_by` → users · `confirmed_at` · `completed_at` · `snoozed_until` · `notified` (bool) · `created_at` · `updated_at`

### jobs (Postgres-backed queue)
`id` · `type` (`classify|reminder|digest`) · `payload` (jsonb) · `status` (`pending|processing|done|failed`) · `attempts` · `max_attempts` (default 3) · `run_after` (timestamptz) · `locked_at` · `last_error` · `created_at` · `updated_at`

### notifications (in-app)
`id` · `level` (`info|urgent`) · `title` · `body` · `task_id` → tasks (nullable) · `read_at` · `created_at`

### settings (global key/value)
Keys: `auto_confirm_enabled` (default `false`) · `auto_confirm_threshold` (default `0.95`) · `telegram_bot_token` · `telegram_chat_id` · `whatsapp_reminder_enabled` · `webhook_secret` · `morning_digest_time` (`07:00`) · `evening_recap_time` (`20:00`) · `quiet_hours_start` (`22:00`) · `quiet_hours_end` (`06:00`) · `weekly_summary_enabled` · `weekly_summary_day` · `timezone` (`Asia/Kolkata`) · `default_reminder_lead` · `last_morning_digest_date` · `last_evening_recap_date` · `last_weekly_summary_date` · data-retention stubs (`retain_chatter_days`, `retain_media_months`).

**Query rules:**
- **Dashboard:** `review_status IN (confirmed, auto_confirmed)`.
- **Review Inbox:** `review_status = pending`, ordered by `confidence ASC` (lowest first).
- **History/audit:** `rejected`, `merged`, `done`, `auto_confirmed` visible; hidden from main dashboard.

---

## 4. Core Screens, Dashboard UX & Parent Review Flow

**Navigation:** mobile-first **bottom tab bar** — **Home · Board · Review · Settings**; on desktop the same becomes a **left sidebar**. Review tab shows a pending-count badge. A floating **＋ Add Task** action is available on Home/Board.

**Screens:**
1. **Login** — email + password on the branded gradient; httpOnly cookie session.
2. **Home (Summary Hub + Timeline)** — stat tiles (Due Today · Exams Soon · Pending Review · Fees Due ₹) + a timeline grouped **Overdue / Today / Tomorrow / This week / Later**. Per-kid filter chips + type filters + priority + due date + completion status.
3. **Board (Kanban)** — columns **To Do → Doing → Done**, drag to move (`board_status`), same filters.
4. **Review Inbox** — `review_status = pending`, lowest-confidence first. Each card: source thumbnail (image/PDF), sender + WhatsApp group, **confidence score**, AI-extracted **inline-editable** fields (title, due date, priority, kid, subject, amount, reminder time), **AI reason** ("Detected homework from Class 5B message…"), **duplicate warning** ("Possible duplicate of X → Merge"), and **Confirm / Edit / Reject / Merge** actions. Auto-confirmed items skip here but show an **"Auto-confirmed by AI"** label and remain editable.
5. **Add Manual Task** — create any task type manually (`source = manual`).
6. **Calendar / Month view** — exams, fees, events, competitions, timetable, and due dates.
7. **Completed / History** — audit of completed, rejected, merged, auto-confirmed tasks; plus unmatched/chatter raw messages.
8. **Task Detail / Edit** — all fields incl. fee + reminder; **source preview** of the original WhatsApp message/image/PDF; collapsible **AI audit** (model, confidence, raw extraction, reason).
9. **Global Search** — by kid, subject, task title, fee, exam, event, or notice.
10. **Settings** — Kids · WhatsApp groups (group_id + display name, match status) · Reminders (Telegram token/chat/test, WhatsApp-back toggle, digest/recap times, quiet hours) · AI (auto-confirm toggle + threshold) · Account (change password, add spouse, sessions) · Webhook (URL + secret) · **Security/Admin** (last login, active sessions, logout everywhere, webhook status, Telegram status, backup status) · **About** (AI privacy note).

**Fee UX:** fee tasks clearly show amount, currency, payment due date, payment status, and a **Mark as Paid** action.

**Reminder UX:** each task supports a reminder time, snooze, and reminder status indicator (💤).

**Parent Review Flow:**
1. AI draft → Review Inbox (`pending`).
2. **Duplicate detection** runs at insert: `findPossibleDuplicate(task): taskId | null`. v1 heuristic = **same kid + same task type + similar subject/title + due_date within ±2 days**. Replaceable later. Result stored in `possible_duplicate_id`.
3. Parent **Confirms** (→ `confirmed`, dashboard), **Edits then confirms**, **Rejects** (→ `rejected`, hidden), or **Merges** (→ `merged` + `merged_into_id`).
4. If auto-confirm on and `confidence ≥ threshold`, draft is created as `auto_confirmed` directly (still editable, labelled).

---

## 5. AI Extraction, Prompt Design & WhatsApp Processing Flow

**Multi-task output:** a single message/image/PDF may contain several actionable items, so the AI **always returns an array of tasks**, each with its own type, kid, subject, title, due date, priority, fee fields (if applicable), confidence, and short reason. One `raw_message` → 0..N `tasks`.

**Kid attribution:**
1. Webhook knows `group_id` → look up `watched_groups` → **candidate kids**.
2. 0 candidates → store raw only, `processing_status = unmatched`, no task.
3. 1 candidate → assign automatically.
4. Multiple candidates → AI uses name/grade/section/content hints; if still ambiguous, best-guess + flag in Review for inline correction.

**Prompt (multimodal):**
- **System prompt:** role (Indian school assistant), today's date + `Asia/Kolkata`, candidate kids (names/grades/sections), strict output JSON schema, rules.
- **User content:** message text + each image (data-URI) + PDF.
- **PDF handling:** first try **native PDF reading** via Gemini/OpenRouter; if unsupported/scanned/oversized/failed, **rasterize PDF pages to images** (`pdf-to-img`/`pdfjs`) and send those.
- **Language:** understand Hindi / Hinglish / regional; **output titles in plain English**.

**Output JSON schema:**
```json
{
  "is_relevant": true,
  "tasks": [
    {
      "type": "homework|test|timetable|competition|event|fee|notice|other",
      "kid_hint": "Aarav | null",
      "subject": "Mathematics | null",
      "title": "string (<=80 chars, plain English)",
      "description": "string | null",
      "due_date": "YYYY-MM-DD | null",
      "due_time": "HH:MM | null",
      "priority": "high|medium|low",
      "amount_due": 4500,
      "currency": "INR",
      "payment_due_date": "YYYY-MM-DD | null",
      "confidence": 0.0,
      "reason": "short parent-friendly explanation"
    }
  ]
}
```

**Extraction rules:**
- **Dates:** resolve relative terms against `received_at` in IST → concrete `YYYY-MM-DD`. **If not confident, leave `due_date` null and flag for review — do not guess strongly.**
- **Priority:** `high` = exam/test/fee or deadline within 48h; `medium` = homework/notice with near deadline; `low` = info/holiday.
- **Relevance:** greetings, thanks, stickers, birthday wishes, emojis-only, general parent discussion → `is_relevant:false` → store raw only (`processing_status = chatter`), no task.
- **Fees:** extract `amount_due`, `currency:INR`, `payment_due_date`; `payment_status` defaults `unpaid`.
- **Confidence is per task**; low-confidence sorts first in Review.
- **AI reason** stored in `ai_extracted_json` and shown in Review/Detail.

**Worker processing flow:**
1. Dequeue `classify` job (`payload: { raw_message_id }`) with `FOR UPDATE SKIP LOCKED`.
2. Load raw_message + media + candidate kids (by `group_id`).
3. Dedup short-circuit on `content_hash`.
4. Build multimodal prompt → call Gemini (timeout ~30s).
5. Parse JSON; for each task: resolve kid → `findPossibleDuplicate` → insert task (`source:ai`, `confidence`, `ai_model`, `ai_extracted_json`, `raw_message_id`); `review_status = pending` unless auto-confirm on AND `confidence ≥ threshold` → `auto_confirmed`; create in-app notification; if `priority:high`, enqueue reminder.
6. Set `raw_messages.processing_status = classified`; mark job `done`.
7. **On failure:** `attempts++`, `run_after = now + 2^attempts min`, status `pending`; after `max_attempts` → `failed` + an **"AI failed, needs manual entry"** in-app notification linking the raw message/media for manual creation.

**Audit:** every AI task keeps `raw_message_id`, `ai_model`, `confidence`, `ai_extracted_json` (incl. reason), and linked original media.

---

## 6. Reminder Rules, Notification Logic & Daily Digest Flow

**Channels (worker-driven):** **Telegram** (primary; rich + inline buttons + commands) · **WhatsApp-back** (secondary, via OpenClaw outbound — see risk) · **in-app** (always-safe fallback; every push also writes a `notification` row).

**Reminder types:**
1. **Per-task reminder** — `reminder_at` + `reminder_status`; fired by a `reminder` job (`run_after = reminder_at`).
2. **Auto-scheduled deadline reminder** — on confirm, if no custom reminder and `due_date` set, schedule one at **evening-before 18:00 IST**. Tasks with `due_time` also get a same-day reminder: **morning nudge 07:00** or **2 hours before `due_time`** (if outside quiet hours).
3. **High-priority instant alert** — on confirm/auto-confirm of a `priority:high` task (respecting quiet hours).
4. **Morning digest** — default **07:00 IST**: due today · high-priority · exams/tests · fees due soon · pending Review count.
5. **Evening recap** — default **20:00 IST**: due tomorrow · pending Review count · high-priority uncompleted.
6. **Weekly summary** — optional, Sunday morning, per kid.
7. **Fee reminder** — **3 days** and **1 day** before `payment_due_date`, **only** if `payment_status` is `unpaid` or `partial` (never if `paid`).

**Quiet hours:** default **22:00–06:00 IST**. Telegram/WhatsApp pushes **deferred** until quiet-hours-end (`run_after` bumped); in-app notifications still created silently. All times in `timezone` setting.

**Scheduling mechanics (no Redis):** worker runs a **node-cron tick** for digests/recap/weekly (composes & sends directly); per-task and fee reminders go through the `jobs` queue (`type: reminder`, `run_after`) reusing retry/backoff.

**Idempotency:** per-task reminders guarded by `reminder_status` transitions; digests guarded by `last_morning_digest_date` / `last_evening_recap_date` / `last_weekly_summary_date` settings keys.

**Telegram interactivity:**
- **Inline buttons:** ✅ **Done** (→ `board_status:done`, `completed_at`) · 💤 **Snooze 1 day** (→ `reminder_at += 1 day`, `reminder_status:snoozed`) · 🔗 **Open Task** (deep link to task detail). Taps hit `/api/webhook/telegram`.
- **Commands:** `/today` · `/week` · `/pending` · `/fees` · `/done <id>` · `/snooze <id>` · `/start`.

**Failure handling:** failed Telegram/WhatsApp send → `reminder_status:failed`, job retry with backoff; after max attempts the in-app notification remains so nothing is silently lost.

**WhatsApp-back risk (explicit):** depends on OpenClaw exposing an **outbound `sendMessage`** endpoint. If unavailable, the app **gracefully continues** with Telegram + in-app only.

---

## 7. Security, Privacy, Auth & Deployment Hardening

**Co-location:** OpenClaw/Baileys and PadhAI run on the **same VPS**. The WhatsApp webhook is **localhost-only** — OpenClaw POSTs to `http://127.0.0.1:3000/api/webhook/whatsapp`; Nginx does **not** expose it publicly; the app port is **not** open to the internet; only Nginx serves the dashboard over HTTPS.

**Webhook defense-in-depth (despite localhost-only):** `x-webhook-secret` with **constant-time** compare · optional **HMAC-SHA256** signature · **timestamp replay guard** (5-min window) · payload/media **size limits** · **MIME allowlist** (`image/*`, `application/pdf`) · **random stored filenames** · no executable uploads · media stored **outside** the public folder.

**Auth & sessions:** **bcrypt cost 12** · **256-bit** session token, only its **SHA-256 hash** stored in DB · cookie `httpOnly` + `Secure` + `SameSite=Lax` · **30-day** expiry with sliding renewal · **logout** + **logout everywhere** · **no public signup** (first account via `scripts/create-user.ts`; spouse login allowed) · **login rate limiting** per IP and per email · **no public forgot-password** (reset via `scripts/set-password.ts` on the VPS) · CSRF via Next.js server actions + same-origin/double-submit token for route handlers.

**Privacy:** school data stays in Postgres + `/var/padhai/media` on the VPS. The **only** external egress is message text/images/PDFs to **OpenRouter/Gemini** for classification (documented plainly). Raw originals remain local. **Media served only via authenticated `/api/media/:id`** — never a public URL or direct path; dir perms `700`, owned by `padhai`. Secrets in `.env` (gitignored), validated at boot. Structured logs without secrets/PII.

**Deployment hardening:** dedicated non-root **`padhai`** user · **PM2** (web + worker) · Postgres on **127.0.0.1** only, least-privilege DB user · **UFW** allows only **22/80/443**, app port blocked externally · **Nginx** reverse proxy + **Let's Encrypt** TLS + HTTP→HTTPS redirect + **HSTS** + security headers (CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `frame-ancestors 'none'`) · SSH key-only, root login disabled · **nightly `pg_dump` + media backup, 14-day retention**, documented restore steps.

**Refinements:**
- **Data-retention settings (stubs in v1):** delete old chatter/unmatched messages after X days · keep confirmed task history · delete old media after X months if unused · manual export/backup option.
- **Security/Admin page:** last login · active sessions · logout everywhere · webhook status · Telegram status · backup status.
- **Media access audit:** media opened from a task is served only after session check; never expose direct paths/public URLs.
- **AI privacy note** (Settings/About): *"PadhAI stores your school data on your VPS. AI extraction sends message text and media to the configured AI provider for classification."*

---

## 8. MVP Build Plan, Milestones, Testing & Deployment

### Project structure
```
padhai/
  src/
    app/
      (auth)/login/
      (app)/ home · board · review · calendar · history · search · settings · task/[id]
      api/ webhook/whatsapp · webhook/telegram · media/[id]
    components/        # shadcn/ui + custom (TaskCard, ReviewCard, StatTile, BottomNav...)
    server/
      db/              # drizzle schema.ts, client, migrations
      auth/            # password (bcrypt), session, rate-limit
      ai/              # prompt.ts, classifier.ts, pdf.ts (native + raster)
      queue/           # enqueue.ts, worker.ts (SKIP LOCKED)
      reminders/       # scheduler.ts (cron), digest.ts, send.ts
      tasks/           # service.ts, dedup.ts (findPossibleDuplicate)
      storage/         # adapter.ts (local; S3 later), media.ts
      whatsapp/        # normalize.ts, outbound.ts
      telegram/        # bot.ts (send, inline buttons, commands)
    lib/               # dates/tz, validation, constants
  worker/ index.ts     # boots queue worker + cron scheduler
  scripts/ create-user.ts · set-password.ts · seed.ts · capture-webhook.ts
  drizzle/             # SQL migrations
  ecosystem.config.cjs # PM2: padhai-web + padhai-worker
  .env.example · DEPLOY.md
```

### Milestones (each independently testable)
- **M0 · Scaffold** — Next.js TS + Tailwind + shadcn, Drizzle+Postgres, env validation, base layout + bottom-nav/sidebar, Vitest. → app boots, `/health` green.
- **M1 · Auth** — users/sessions schema, bcrypt, login, cookie session, rate limit, `create-user` CLI, route protection. → log in/out works.
- **M2 · Kids & Groups** — schema migration, Kids CRUD, watched_groups CRUD (group_id+name), Settings shell. → manage kids + groups.
- **M3 · Tasks core (no AI)** — tasks schema, Add Manual Task, Home (hub+timeline), Board (Kanban), filters, Task Detail. → manual tracking end-to-end.
- **M4 · Ingest** — webhook (localhost, secret, HMAC, timestamp, size/MIME limits), raw_messages + media_assets, storage adapter, auth-gated `/api/media/:id`, processing_status. → OpenClaw messages land as raw + media.
- **M5 · AI pipeline** — jobs queue + worker, Gemini multimodal prompt, native PDF + raster fallback, multi-task array, dedup, drafts → Review. → real message → AI draft tasks.
- **M6 · Review Inbox** — review screen, inline edit, confirm/edit/reject/merge, duplicate display, auto-confirm toggle+threshold+label. → full review flow.
- **M7 · Reminders & Telegram** — reminder jobs, auto-schedule, digests/recap/weekly cron, quiet hours, Telegram (send, inline Done/Snooze/Open, commands, webhook), WhatsApp-back (guarded), in-app bell. → reminders fire.
- **M8 · Remaining screens** — Calendar, History/audit, Global Search, Security/Admin page, About/privacy note, data-retention setting stubs. → all screens present.
- **M9 · Harden & deploy** — Nginx+TLS, ufw, PM2 ecosystem, backup script + restore docs, DEPLOY.md. → live on `padhai.app`.

### Seed / demo data (for dev & UI testing — `scripts/seed.ts`)
- 2 kids · 2 watched WhatsApp groups
- 5 manual tasks · 3 pending-review tasks · 1 fee task · 1 possible-duplicate task · 1 completed task
- 1 sample raw message with image/PDF metadata
- Exercises Home, Board, Review Inbox, Calendar, History, Search, Fees, Task Detail before real WhatsApp is connected.

### Testing strategy (TDD throughout)
- **Unit (Vitest):** dedup `findPossibleDuplicate`, date resolution, prompt builder, classifier JSON parse/validate, fee extraction, reminder scheduling, quiet-hours deferral, password/session, webhook secret/HMAC/timestamp, MIME validation, storage adapter.
- **Integration:** webhook → raw+media+enqueue; worker with **mocked OpenRouter** (fixtures: multi-task, fee, low-confidence, irrelevant, scanned-PDF); review/merge DB transitions; reminder idempotency; Telegram callback handling.
- **E2E (Playwright, optional v1):** login → confirm a seeded draft → mark done → calendar render.
- **Mock all external services** (OpenRouter, Telegram, OpenClaw outbound).

### Acceptance checklist
- [ ] Auth: login/logout/logout-everywhere; rate-limit lockout; CLI create-user.
- [ ] Webhook: rejects bad/missing secret; accepts valid; dedups; stores image + PDF; rejects oversized/wrong MIME.
- [ ] Extraction: text/image/native-PDF/scanned-PDF→raster all produce tasks; multi-item→multiple tasks; chatter→none (marked chatter); unmatched group→raw only (marked unmatched).
- [ ] Review: low-confidence first; AI reason + source preview shown; confirm/edit/reject/merge transitions; `possible_duplicate_id` flagged; auto-confirm off by default; when on + ≥ threshold → `auto_confirmed` + label, still editable.
- [ ] Fees: amount/currency/status; mark-as-paid; reminders 3d+1d only if unpaid/partial; none if paid.
- [ ] Reminders: deadline evening-before; due_time same-day; quiet-hours defer; snooze reschedules; Telegram Done sets done+completed_at; Open Task link; digests idempotent (settings date keys); digest/recap contents correct.
- [ ] WhatsApp-back works if OpenClaw outbound present; degrades gracefully if not.
- [ ] Privacy: media only via authenticated route; no public path; dashboard shows only confirmed+auto_confirmed; history shows rejected/merged/completed/auto.
- [ ] Calendar renders exams/fees/events/due dates; global search by kid/subject/title/fee/exam/event/notice.
- [ ] Security page: last login, active sessions, webhook/Telegram/backup status.
- [ ] Backup cron produces dump; restore steps verified.
- [ ] Deployment: HTTPS + redirect; app port closed; ufw; non-root; headers present.

### Deployment steps (DEPLOY.md outline)
1. Provision Ubuntu VPS; create `padhai` user; install Node 20+, Postgres, Nginx, certbot, PM2.
2. Create DB + user; set `DATABASE_URL`.
3. `npm ci`; copy `.env.example` → `.env`, fill secrets; validate at boot.
4. Run Drizzle migrations; create first user via CLI.
5. `next build`.
6. `pm2 start ecosystem.config.cjs` (web + worker); `pm2 save`; `pm2 startup`.
7. Configure Nginx (proxy :3000, TLS, headers, `client_max_body_size`); `certbot --nginx`.
8. `ufw allow 22,80,443`; enable.
9. Point OpenClaw webhook to `http://127.0.0.1:3000/api/webhook/whatsapp` with secret; set Telegram `setWebhook` with secret token.
10. Enable nightly backup cron; verify dump + restore.
11. Smoke test: send a WhatsApp message → appears in Review.

### Out of scope (v1)
No multi-family SaaS · no billing · no public signup · no native mobile app · no email channel · no embeddings-based dedup · no automatic retention purging (settings stubs only) · no RBAC.

---

## Open Dependencies & Risks
- **OpenClaw outbound `sendMessage`** required for WhatsApp-back; degrade to Telegram + in-app if absent.
- **Gemini/OpenRouter PDF support** variability → native-first with raster fallback.
- **WhatsApp group reading** relies on the unofficial Baileys gateway (no official group API exists); inherent ToS consideration, accepted for private family use.
- **AI egress:** message text + media leave the VPS to OpenRouter/Gemini for classification (documented).

---

*Approved by the family owner on 2026-06-19 across Sections 1–8. Next: implementation plan via writing-plans.*
