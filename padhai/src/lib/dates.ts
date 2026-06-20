export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export type TimelineBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none';

export function timelineBucket(dueDate: string | null, today: string): TimelineBucket {
  if (!dueDate) return 'none';
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const ref = Date.parse(`${today}T00:00:00Z`);
  const days = Math.round((due - ref) / 86_400_000);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'week';
  return 'later';
}
