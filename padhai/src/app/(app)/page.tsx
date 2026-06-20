import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Home</h1>
      <Link href="/task/new"><Button>＋ Add Task</Button></Link>
    </div>
  );
}
