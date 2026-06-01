import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function UnauthorizedPage() {
  return (
    <div className="app-empty-stage">
      <Card className="center p-[18px] shadow-[var(--sh-sm)]" style={{ width: 420, maxWidth: 'calc(100vw - 32px)' }}>
        <div className="lead-ic mb12">
          <LockKeyhole size={18} />
        </div>
        <h1 className="t-title">Nemáš přístup</h1>
        <p className="muted t-sm mt8 mb16">Přihlas se správným účtem nebo požádej o pozvánku do výletu.</p>
        <Button asChild>
          <Link href="/trips">Zpět na výlety</Link>
        </Button>
      </Card>
    </div>
  );
}
