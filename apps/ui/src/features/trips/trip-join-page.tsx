'use client';

import { CalendarDays, MapPin, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
import { AccessScreen } from './components/access-screen';
import { useTripPlanner } from './hooks/use-trip-planner';

type InvitePreview = {
  id: string;
  name: string;
  destination: string | null;
  startsAt: string | null;
  endsAt: string | null;
  currency: string;
  memberCount: number;
};

function formatInviteRange(preview: InvitePreview) {
  if (!preview.startsAt && !preview.endsAt) return 'Termín otevřený';
  const formatter = new Intl.DateTimeFormat('cs-CZ', { month: 'short', day: 'numeric' });
  const start = preview.startsAt ? formatter.format(new Date(preview.startsAt)) : 'Otevřeno';
  const end = preview.endsAt ? formatter.format(new Date(preview.endsAt)) : 'Otevřeno';
  return `${start} - ${end}`;
}

export function TripJoinPage({ inviteCode }: { inviteCode: string }) {
  const planner = useTripPlanner({ redirectAfterSignIn: false });
  const { state, actions } = planner;
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingPreview(true);
    apiFetch<InvitePreview>(`/trips/invite/${encodeURIComponent(inviteCode)}`, {}, '')
      .then((data) => {
        if (!cancelled) {
          setPreview(data);
          setPreviewError('');
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewError('Pozvánka neexistuje nebo už není dostupná.');
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  if (!state.viewerEmail) {
    return <AccessScreen message={state.message || 'Nejdřív se přihlas, potom tě připojíme k výletu.'} onSignIn={(data) => actions.signIn(data)} />;
  }

  return (
    <div className="app-empty-stage">
      <Card className="p-[18px] shadow-[var(--sh-sm)]" style={{ width: 430, maxWidth: 'calc(100vw - 32px)' }}>
        <div className="row g10 mb12">
          <div className="lead-ic">
            <UserPlus size={18} />
          </div>
          <div className="col flex1" style={{ minWidth: 0 }}>
            <span className="t-title">Připojit se k výletu</span>
            <span className="muted t-sm mt4">{state.viewerEmail}</span>
          </div>
        </div>

        {loadingPreview && <div className="muted t-sm">Načítám pozvánku...</div>}
        {previewError && <div className="badge red mb12">{previewError}</div>}

        {preview && (
          <>
            <div className="card p14 mb14" style={{ background: 'var(--subtle)' }}>
              <div className="t-h2">{preview.name}</div>
              <div className="row g10 mt10 muted t-sm wrap">
                <span className="row g4"><MapPin />{preview.destination ?? 'Bez destinace'}</span>
                <span className="row g4"><CalendarDays />{formatInviteRange(preview)}</span>
                <span className="row g4"><Users />{preview.memberCount} členů</span>
              </div>
            </div>
            <Button className="w-full" type="button" onClick={() => void actions.joinTripByInviteCode(inviteCode)}>
              <UserPlus />Připojit se
            </Button>
          </>
        )}

        {state.message && <div className="badge red mt12">{state.message}</div>}
      </Card>
    </div>
  );
}
