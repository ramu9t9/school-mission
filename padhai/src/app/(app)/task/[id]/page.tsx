import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/server/db/client';
import { requireUser } from '@/server/auth/current-user';
import { listKids } from '@/server/kids/kids';
import { getTask, updateTask, setPaymentStatus, deleteTask, type TaskType } from '@/server/tasks/tasks';
import { TaskForm } from '../task-form';
import { Button } from '@/components/ui/button';

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id: idStr } = await params;
  const id = Number(idStr);
  const db = getDb();
  const task = await getTask(db, id);
  if (!task) notFound();
  const kids = await listKids(db);

  async function saveAction(formData: FormData) {
    'use server';
    await requireUser();
    const title = String(formData.get('title') ?? '').trim();
    if (!title) return;
    const amountRaw = String(formData.get('amountDue') ?? '');
    await updateTask(getDb(), id, {
      title,
      type: String(formData.get('type') ?? 'other') as TaskType,
      subject: String(formData.get('subject') ?? '') || undefined,
      description: String(formData.get('description') ?? '') || undefined,
      dueDate: String(formData.get('dueDate') ?? '') || undefined,
      dueTime: String(formData.get('dueTime') ?? '') || undefined,
      priority: String(formData.get('priority') ?? 'low') as 'high' | 'medium' | 'low',
      amountDue: amountRaw ? Number(amountRaw) : undefined,
      paymentDueDate: String(formData.get('paymentDueDate') ?? '') || undefined,
    });
    revalidatePath(`/task/${id}`);
    redirect(`/task/${id}`);
  }

  async function markPaidAction() {
    'use server';
    await requireUser();
    await setPaymentStatus(getDb(), id, 'paid');
    revalidatePath(`/task/${id}`);
  }

  async function deleteAction() {
    'use server';
    await requireUser();
    await deleteTask(getDb(), id);
    redirect('/');
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-2xl font-bold">Edit task</h1>

      {task.type === 'fee' && (
        <section className="space-y-2 rounded-xl border border-pink-500/30 bg-pink-500/10 p-3">
          <div className="text-sm">₹{Number(task.amountDue ?? 0).toLocaleString('en-IN')} · {task.paymentStatus}{task.paymentDueDate ? ` · due ${task.paymentDueDate}` : ''}</div>
          {task.paymentStatus !== 'paid' && (
            <form action={markPaidAction}><Button type="submit" size="sm">Mark as paid</Button></form>
          )}
        </section>
      )}

      <TaskForm
        kids={kids.map((k) => ({ id: k.id, name: k.name }))}
        action={saveAction}
        submitLabel="Save changes"
        initial={{
          kidId: task.kidId, type: task.type, title: task.title, subject: task.subject ?? undefined,
          description: task.description ?? undefined, dueDate: task.dueDate ?? undefined, dueTime: task.dueTime?.slice(0, 5) ?? undefined,
          priority: task.priority, amountDue: task.amountDue ?? undefined, paymentDueDate: task.paymentDueDate ?? undefined,
        }}
      />

      <form action={deleteAction}><Button type="submit" variant="ghost" size="sm" className="text-red-400">Delete task</Button></form>
    </div>
  );
}
