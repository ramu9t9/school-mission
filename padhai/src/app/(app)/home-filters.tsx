import Link from 'next/link';

export interface KidChip { id: number; name: string }
const TYPES = ['homework', 'test', 'timetable', 'competition', 'event', 'fee', 'notice', 'other'];

function chipCls(active: boolean) {
  return `rounded-full border px-3 py-1 text-xs ${active ? 'border-violet-500 bg-violet-500/20 text-violet-200' : 'border-white/10 text-zinc-400'}`;
}

export function HomeFilters({ kids, kid, type }: { kids: KidChip[]; kid?: string; type?: string }) {
  const q = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { kid, type, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/?${s}` : '/';
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Link href={q({ kid: undefined })} className={chipCls(!kid)}>All kids</Link>
        {kids.map((k) => (
          <Link key={k.id} href={q({ kid: String(k.id) })} className={chipCls(kid === String(k.id))}>{k.name}</Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={q({ type: undefined })} className={chipCls(!type)}>All types</Link>
        {TYPES.map((t) => (
          <Link key={t} href={q({ type: t })} className={chipCls(type === t)}>{t}</Link>
        ))}
      </div>
    </div>
  );
}
