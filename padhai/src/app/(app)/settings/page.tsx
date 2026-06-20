import { logoutEverywhereAction } from '@/server/auth/actions';
import { Button } from '@/components/ui/button';
import { KidsSection } from './kids-section';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <KidsSection />
      <section className="space-y-3 rounded-xl border border-white/10 p-4">
        <h2 className="font-semibold">Security</h2>
        <p className="text-sm text-zinc-400">Sign out of every device where you are logged in.</p>
        <form action={logoutEverywhereAction}>
          <Button type="submit" variant="outline" size="sm">Log out everywhere</Button>
        </form>
      </section>
    </div>
  );
}
