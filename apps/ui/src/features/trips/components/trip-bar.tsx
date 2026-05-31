import { ChevronDown } from 'lucide-react';
import { AvatarRow } from './avatar';
import { formatTripRange } from '../lib/format';
import type { Trip } from '../types';

export function TripBar({ trip }: { trip?: Trip; refreshing?: boolean; onRefresh?: () => void }) {
  return (
    <div className="appbar flush">
      <div className="col flex1" style={{ minWidth: 0 }}>
        <div className="row g8">
          <span className="t-h2" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trip?.name ?? 'Plánovač cest'}</span>
          <ChevronDown size={17} className="faint" />
        </div>
        <span className="muted t-xs mt4">{trip?.destination ?? 'Zatím bez destinace'} · {formatTripRange(trip)}</span>
      </div>
      <AvatarRow names={(trip?.members ?? []).map((member) => member.user.name)} />
    </div>
  );
}
