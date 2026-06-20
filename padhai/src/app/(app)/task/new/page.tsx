import { redirect } from 'next/navigation';
import { getDb } from '@/server/db/client';
import { requireUser } from '@/server/auth/current-user';
import { listKids } from '@/server/kids/kids';
import { createManualTask, type TaskType } from '@/server/tasks/tasks';
import { TaskForm } from '../task-form';

async function createTaskAction(formData: FormData) {
  'use server';
  const user = await requireUser();
  const kidId = Number(formData.get('kidId'));
  const title = String(formData.get('title') ?? '').trim();
  if (!Number.isInteger(kidId) || !title) return;
  const amountRaw = String(formData.get('amountDue') ?? '');
  await createManualTask(getDb(), user.id, {
    kidId,
    type: String(formData.get('type') ?? 'other') as TaskType,
    title,
    subject: String(formData.get('subject') ?? '') || undefined,
    description: String(formData.get('description') ?? '') || undefined,
    dueDate: String(formData.get('dueDate') ?? '') || undefined,
    dueTime: String(formData.get('dueTime') ?? '') || undefined,
    priority: (String(formData.get('priority') ?? 'low') as 'high' | 'medium' | 'low'),
    amountDue: amountRaw ? Number(amountRaw) : undefined,
    paymentDueDate: String(formData.get('paymentDueDate') ?? '') || undefined,
  });
  redirect('/');
}

export default async function NewTaskPage() {
  await requireUser();
  const kids = await listKids(getDb());
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Add Task</h1>
      <TaskForm kids={kids.map((k) => ({ id: k.id, name: k.name }))} action={createTaskAction} submitLabel="Add task" />
    </div>
  );
}
