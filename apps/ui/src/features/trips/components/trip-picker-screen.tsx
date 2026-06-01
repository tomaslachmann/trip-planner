import { CalendarDays, LogOut, Plane, Plus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ValidatedForm } from '@/components/ui/validated-form';
import { AvatarRow } from './avatar';
import { TripButton, TripCard } from './design-system';
import { formatTripRange } from '../lib/format';
import type { Trip } from '../types';

function TripCardRow({
  trip,
  joined,
  onOpen,
  onJoin,
}: {
  trip: Trip;
  joined: boolean;
  onOpen: () => void;
  onJoin: () => void;
}) {
  return (
    <TripCard pad className="trip-pick-card">
      <div className="row between g12">
        <div className="col flex1" style={{ minWidth: 0 }}>
          <div className="row g8">
            <span className="t-h2" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{trip.name}</span>
            <span className={`badge ${joined ? 'green' : 'muted'}`}>{joined ? 'Připojeno' : 'Pozvánka'}</span>
          </div>
          <span className="muted t-sm mt4">{trip.destination ?? 'Bez destinace'}</span>
          <div className="row g10 mt10 muted t-xs wrap">
            <span className="row g4"><CalendarDays />{formatTripRange(trip)}</span>
            <span>{trip.members?.length ?? 0} členů</span>
            {joined && <span className="mono">{trip.inviteCode}</span>}
          </div>
        </div>
        <AvatarRow names={(trip.members ?? []).map((member) => member.user.name)} />
      </div>
      <TripButton tone={joined ? 'primary' : 'outline'} block className="mt14" type="button" onClick={joined ? onOpen : onJoin}>
        {joined ? <Plane /> : <UserPlus />}
        {joined ? 'Otevřít výlet' : 'Připojit se'}
      </TripButton>
    </TripCard>
  );
}

export function TripPickerScreen({
  email,
  joinedTrips,
  availableTrips,
  message,
  onOpenTrip,
  onJoinTrip,
  onJoinInviteCode,
  onCreateTrip,
  onSignOut,
}: {
  email: string;
  joinedTrips: Trip[];
  availableTrips: Trip[];
  message?: string | null;
  onOpenTrip: (tripId: string) => void;
  onJoinTrip: (tripId: string) => void;
  onJoinInviteCode: (inviteCode: string) => void;
  onCreateTrip: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="trip-picker-shell">
      <div className="trip-picker-top">
        <div className="row g12">
          <div className="desk-brand" style={{ padding: 0 }}>
            <div className="logo"><Plane /></div>
          </div>
          <div className="col">
            <span className="t-title">Vyber výlet</span>
            <span className="muted t-sm mt4">{email}</span>
          </div>
        </div>
        <div className="row g8">
          <TripButton tone="outline" type="button" onClick={onCreateTrip}><Plus />Vytvořit výlet</TripButton>
          <TripButton tone="ghost" type="button" onClick={onSignOut}><LogOut />Odhlásit</TripButton>
        </div>
      </div>

      {message && <div className="badge red trip-picker-alert">{message}</div>}

      <div className="trip-picker-grid">
        <section className="col g12">
          <div>
            <div className="t-h2">Připojené výlety</div>
            <div className="muted t-sm mt4">Výlety, kde už je tvůj e-mail členem.</div>
          </div>
          {joinedTrips.length === 0 && <TripCard pad className="muted t-sm center">Pro tenhle e-mail tu nejsou žádné připojené výlety.</TripCard>}
          {joinedTrips.map((trip) => (
            <TripCardRow key={trip.id} trip={trip} joined onOpen={() => onOpenTrip(trip.id)} onJoin={() => onJoinTrip(trip.id)} />
          ))}
        </section>

        <section className="col g12">
          <div>
            <div className="t-h2">Připojit přes pozvánku</div>
            <div className="muted t-sm mt4">Vlož kód z odkazu pozvánky. Veřejný seznam výletů je vypnutý.</div>
          </div>
          <TripCard pad>
            <ValidatedForm
              className="row g8"
              onSubmit={(event) => {
                event.preventDefault();
                const inviteCode = String(new FormData(event.currentTarget).get('inviteCode') ?? '').trim();
                if (inviteCode) onJoinInviteCode(inviteCode);
              }}
            >
              <Input className="flex1" name="inviteCode" placeholder="Kód pozvánky" required />
              <Button type="submit"><UserPlus />Připojit</Button>
            </ValidatedForm>
          </TripCard>
          {availableTrips.map((trip) => (
            <TripCardRow key={trip.id} trip={trip} joined={false} onOpen={() => onOpenTrip(trip.id)} onJoin={() => onJoinTrip(trip.id)} />
          ))}
        </section>
      </div>
    </div>
  );
}
