import { CalendarRange, Plus, Shield, Trash2 } from 'lucide-react';
import { Avatar } from './avatar';
import type { Trip } from '../types';

function toLocalInputValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatWindow(startsAt: string, endsAt: string) {
  const formatter = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${formatter.format(new Date(startsAt))} - ${formatter.format(new Date(endsAt))}`;
}

export function MembersPanel({
  trip,
  actorUserId,
  actorRole,
  onAddAvailability,
  onDeleteAvailability,
}: {
  trip?: Trip;
  actorUserId?: string;
  actorRole?: string;
  onAddAvailability: (tripMemberId: string, data: FormData) => void;
  onDeleteAvailability: (availabilityId: string) => void;
}) {
  const members = trip?.members ?? [];
  const canManageAll = actorRole === 'OWNER' || actorRole === 'ADMIN';
  return (
    <div className="scroll px18" style={{ flex: 1, paddingTop: 10, paddingBottom: 18 }}>
      <div className="card pad sh mb16">
        <div className="row between">
          <div className="col">
            <span className="t-h3">Kód pozvánky</span>
            <span className="muted t-xs mt4">{trip?.inviteCode ?? 'Nejdřív vytvoř trip'}</span>
          </div>
        </div>
      </div>
      {members.map((member, index) => (
        <div key={member.id}>
          {index > 0 && <hr className="sep" />}
          <div className="row" style={{ padding: '13px 0' }}>
            <Avatar name={member.user.name} size="lg" />
            <div className="col flex1" style={{ minWidth: 0 }}>
              <div className="row g8">
                <span className="t-h3">{member.user.name}</span>
                <span className={`badge ${member.role === 'OWNER' ? 'solid' : 'muted'}`}><Shield />{member.role === 'OWNER' ? 'vlastník' : 'člen'}</span>
              </div>
              <span className="muted t-xs mt4">{member.user.email}</span>
              <div className="row g6 mt8 wrap">
                {(member.availabilityWindows ?? []).length === 0 && <span className="badge amber"><CalendarRange />Počítá se celý trip</span>}
                {(member.availabilityWindows ?? []).map((window) => (
                  <div className="badge green" key={window.id}>
                    <CalendarRange />{formatWindow(window.startsAt, window.endsAt)}
                    {window.note && <span className="muted">{window.note}</span>}
                    {(canManageAll || member.userId === actorUserId) && (
                      <button className="iconbtn plain" style={{ width: 22, height: 22 }} type="button" onClick={() => onDeleteAvailability(window.id)} title="Smazat dostupnost"><Trash2 /></button>
                    )}
                  </div>
                ))}
              </div>
              {(canManageAll || member.userId === actorUserId) && (
                <form
                  className="card mt12"
                  style={{ padding: 12, background: 'var(--muted)', boxShadow: 'none' }}
                  onSubmit={(event) => {
                    event.preventDefault();
                    onAddAvailability(member.id, new FormData(event.currentTarget));
                    event.currentTarget.reset();
                  }}
                >
                  <div className="grid2 g8">
                    <div>
                      <label className="field-label" htmlFor={`startsAt-${member.id}`}>Od</label>
                      <input className="input" id={`startsAt-${member.id}`} name="startsAt" type="datetime-local" defaultValue={toLocalInputValue(trip?.startsAt)} />
                    </div>
                    <div>
                      <label className="field-label" htmlFor={`endsAt-${member.id}`}>Do</label>
                      <input className="input" id={`endsAt-${member.id}`} name="endsAt" type="datetime-local" defaultValue={toLocalInputValue(trip?.endsAt)} />
                    </div>
                  </div>
                  <label className="field-label mt10" htmlFor={`note-${member.id}`}>Poznámka</label>
                  <input className="input" id={`note-${member.id}`} name="note" placeholder="Přiletí později, odjíždí dřív..." />
                  <button className="btn outline sm mt10" type="submit"><Plus />Přidat dostupnost</button>
                </form>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
