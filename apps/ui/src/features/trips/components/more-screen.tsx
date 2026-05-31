import { Activity, CheckCircle2, ChevronRight, FileText, ListChecks, Settings, Users, Vote } from 'lucide-react';
import { AvatarRow } from './avatar';
import { formatTripRange } from '../lib/format';
import type { TripPlannerController } from '../hooks/use-trip-planner';

const items = [
  { key: 'members', label: 'Členové', icon: Users },
  { key: 'activity', label: 'Aktivita', icon: Activity },
  { key: 'settings', label: 'Nastavení tripu', icon: Settings },
  { key: 'polls', label: 'Hlasování', icon: Vote },
  { key: 'documents', label: 'Dokumenty', icon: FileText },
  { key: 'checklist', label: 'Checklist', icon: ListChecks },
];

export function MoreScreen({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const approved = state.data.places.filter((place) => (place.votes ?? []).some((vote) => vote.value === 'MUST_HAVE' || vote.value === 'UP')).length;
  const totalSettlements = state.data.settlements.reduce((sum, settlement) => sum + settlement.amount, 0);

  return (
    <div className="screen">
      <div className="appbar flush" style={{ paddingTop: 14 }}>
        <span className="t-title flex1">Více</span>
      </div>
      <div className="scroll px18" style={{ flex: 1, paddingBottom: 18 }}>
        <div className="card sh pad">
          <div className="row between">
            <div className="col" style={{ minWidth: 0 }}>
              <span className="t-h2" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state.selectedTrip?.name ?? 'Trip'}</span>
              <span className="muted t-xs mt4">{state.selectedTrip?.destination ?? 'Bez destinace'} · {formatTripRange(state.selectedTrip)}</span>
            </div>
            <AvatarRow names={(state.selectedTrip?.members ?? []).map((member) => member.user.name)} />
          </div>
          <div className="row g8 mt14 wrap">
            <span className="badge green"><CheckCircle2 />{approved} schváleno</span>
            <span className="badge amber tnum">{Math.round(totalSettlements)} {state.selectedTrip?.currency ?? 'EUR'} k vyrovnání</span>
            <span className="badge muted">{state.selectedTrip?.members?.length ?? 0} lidí</span>
          </div>
        </div>

        <div className="card mt16" style={{ overflow: 'hidden' }}>
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.key}>
                {index > 0 && <hr className="sep" />}
                <button
                  className="more-row"
                  type="button"
                  onClick={() => {
                    if (item.key === 'members') actions.setActiveTab('members');
                  }}
                >
                  <div className="lead-ic" style={{ width: 34, height: 34, borderRadius: 9 }}><Icon /></div>
                  <span className="t-body flex1 medi">{item.label}</span>
                  <ChevronRight className="faint" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
