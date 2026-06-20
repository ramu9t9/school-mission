'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface KidOption { id: number; name: string }
export interface TaskFormValues {
  kidId?: number; type?: string; title?: string; subject?: string; description?: string;
  dueDate?: string; dueTime?: string; priority?: string; amountDue?: string; paymentDueDate?: string;
}

const TYPES = ['homework', 'test', 'timetable', 'competition', 'event', 'fee', 'notice', 'other'];
const inputCls = 'w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500';

export function TaskForm({
  kids, action, initial = {}, submitLabel, error,
}: {
  kids: KidOption[];
  action: (formData: FormData) => void;
  initial?: TaskFormValues;
  submitLabel: string;
  error?: string | null;
}) {
  const [type, setType] = useState(initial.type ?? 'homework');
  return (
    <form action={action} className="space-y-3">
      <select name="kidId" defaultValue={initial.kidId ?? ''} required className={inputCls}>
        <option value="" disabled>Select kid</option>
        {kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
      </select>
      <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
        {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <input name="title" required defaultValue={initial.title} placeholder="Title" className={inputCls} />
      <input name="subject" defaultValue={initial.subject} placeholder="Subject (optional)" className={inputCls} />
      <textarea name="description" defaultValue={initial.description} placeholder="Description (optional)" className={inputCls} />
      <div className="flex gap-2">
        <input type="date" name="dueDate" defaultValue={initial.dueDate} className={inputCls} />
        <input type="time" name="dueTime" defaultValue={initial.dueTime} className={inputCls} />
      </div>
      <select name="priority" defaultValue={initial.priority ?? 'low'} className={inputCls}>
        <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
      </select>
      {type === 'fee' && (
        <div className="flex gap-2">
          <input type="number" step="0.01" name="amountDue" defaultValue={initial.amountDue} placeholder="Amount (₹)" className={inputCls} />
          <input type="date" name="paymentDueDate" defaultValue={initial.paymentDueDate} className={inputCls} />
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" className="w-full">{submitLabel}</Button>
    </form>
  );
}
