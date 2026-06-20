'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from '@/server/auth/actions';
import { Button } from '@/components/ui/button';

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-xl font-extrabold tracking-tight">
          Padh<span className="text-violet-400">AI</span>
        </div>
        <p className="text-sm text-zinc-400">Sign in to your family dashboard.</p>
        <input
          name="email" type="email" required placeholder="Email"
          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500"
        />
        <input
          name="password" type="password" required placeholder="Password"
          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-violet-500"
        />
        {state.error && <p className="text-sm text-red-400">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
