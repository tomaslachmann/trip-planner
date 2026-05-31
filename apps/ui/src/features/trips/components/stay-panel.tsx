import { BedDouble, Check, ExternalLink, Link2, MessageCircle, Minus, Plus, Search, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { accommodationStatusMeta, getAccommodationSummary, type AccommodationStatus, type AccommodationVoteValue } from '../lib/accommodation-scoring';
import type { Accommodation, Place, Trip } from '../types';

function currencyFor(trip?: Trip, place?: Place, stay?: Accommodation) {
  return stay?.currency ?? place?.accommodationCurrency ?? trip?.currency ?? 'EUR';
}

function money(value: string | number | null | undefined, currency = 'EUR') {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (numeric === undefined || numeric === null || !Number.isFinite(numeric)) return '-';
  return `${Math.round(numeric).toLocaleString('cs-CZ')} ${currency}`;
}

function tripNights(trip?: Trip, place?: Place) {
  if (place?.durationMin) return Math.max(1, Math.round(place.durationMin / 1440));
  if (!trip?.startsAt || !trip.endsAt) return 1;
  const start = new Date(trip.startsAt);
  const end = new Date(trip.endsAt);
  const diff = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  return Math.max(1, diff);
}

function sourceLabel(place: Place) {
  try {
    const url = new URL(place.sourceUrl ?? place.accommodationDeepLinkUrl ?? '');
    return url.hostname.replace(/^www\./, '');
  } catch {
    return place.accommodationProvider ?? 'odkaz';
  }
}

export function StayPanel({
  trip,
  stays,
  savedPlaces = [],
  actorUserId,
  selectedId,
  searching,
  layout = 'panel',
  onSearch,
  onSelect,
  onSave,
  onSelectSaved,
  onVotePlace,
  onStatusChange,
}: {
  trip?: Trip;
  stays: Accommodation[];
  savedPlaces?: Place[];
  actorUserId?: string;
  selectedId?: string;
  searching: boolean;
  layout?: 'panel' | 'desktop';
  onSearch: (data: FormData) => void;
  onSelect: (id: string) => void;
  onSave: (stay: Accommodation) => void;
  onSelectSaved?: (id: string) => void;
  onVotePlace?: (placeId: string, value: AccommodationVoteValue) => void;
  onStatusChange?: (placeId: string, status: AccommodationStatus) => void;
}) {
  const tripMembers = trip?.members ?? [];
  const members = Math.max(1, tripMembers.length || 1);
  const summaries = new Map(savedPlaces.map((place) => [place.id, getAccommodationSummary(place, tripMembers, actorUserId)]));
  const selectedCount = savedPlaces.filter((place) => ['SELECTED', 'BOOKED'].includes(summaries.get(place.id)?.status ?? 'SAVED')).length;
  const shortlistCount = savedPlaces.filter((place) => summaries.get(place.id)?.status === 'SHORTLISTED').length;
  const rejectedCount = savedPlaces.filter((place) => summaries.get(place.id)?.status === 'REJECTED').length;
  const savedByExternalId = new Map(savedPlaces.map((place) => [place.accommodationExternalId, place]));

  return (
    <div className="scroll px18" style={{ flex: 1, paddingTop: 10, paddingBottom: 18 }}>
      <div className="row between mb12">
        <div>
          <h1 className={layout === 'desktop' ? 'desk-h' : 't-h2'}>Ubytování</h1>
          <span className="muted t-xs">{savedPlaces.length} kandidátů · {tripNights(trip)} nocí</span>
        </div>
        <span className="badge muted">{members} lidí</span>
      </div>

      <div className="grid3 mb16">
        <Card className="p-[12px]" style={{ background: 'var(--subtle)' }}><span className="faint t-xs">Vybráno</span><div className="t-h2 tnum mt4">{selectedCount}</div></Card>
        <Card className="p-[12px]" style={{ background: 'var(--subtle)' }}><span className="faint t-xs">Shortlist</span><div className="t-h2 tnum mt4">{shortlistCount}</div></Card>
        <Card className="p-[12px]" style={{ background: 'var(--subtle)' }}><span className="faint t-xs">Proti</span><div className="t-h2 tnum mt4">{rejectedCount}</div></Card>
      </div>

      {savedPlaces.length > 0 && (
        <div className={layout === 'desktop' ? 'grid3 mb16' : 'col g12 mb16'}>
          {savedPlaces.map((place) => {
            const summary = summaries.get(place.id) ?? getAccommodationSummary(place, tripMembers, actorUserId);
            const { stats, status, statusMeta: meta, statusFlow } = summary;
            const total = typeof place.estimatedCost === 'string' ? Number(place.estimatedCost) : place.estimatedCost;
            const perPerson = total && Number.isFinite(total) ? total / members : undefined;
            const currency = currencyFor(trip, place);
            const missingNames = stats.missingVoters.map((member) => member.user.name);
            return (
              <Card className="shadow-[var(--sh-sm)] overflow-hidden" key={place.id}>
                <div className="receipt center" style={{ height: layout === 'desktop' ? 108 : 120, borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: 0 }}>
                  <span className="row g6 t-xs mono muted"><BedDouble />foto ubytování</span>
                </div>
                <div className="p16">
                  <div className="row between g10">
                    <div className="col flex1" style={{ minWidth: 0 }}>
                      <button className="t-h2 ellipsis text-left" type="button" onClick={() => onSelectSaved?.(place.id)}>{place.name}</button>
                      <span className="row g4 muted t-xs mt4" style={{ color: 'var(--c-see)' }}><Link2 size={12} />{sourceLabel(place)}</span>
                    </div>
                    <span className={`badge ${meta.cls}`}>{meta.label}</span>
                  </div>

                  <div className="grid3 mt12">
                    <Card className="center p-[8px]" style={{ background: 'var(--subtle)' }}><div className="t-h3 tnum">{money(total, currency)}</div><div className="faint t-xs">celkem</div></Card>
                    <Card className="center p-[8px]" style={{ background: 'var(--subtle)' }}><div className="t-h3 tnum">{money(perPerson, currency)}</div><div className="faint t-xs">osoba</div></Card>
                    <Card className="center p-[8px]" style={{ background: 'var(--subtle)' }}><div className="t-h3">{tripNights(trip, place)}</div><div className="faint t-xs">nocí</div></Card>
                  </div>

                  <div className="row g14 mt12" style={{ alignItems: 'flex-start' }}>
                    <div className="col flex1 g6">
                      <span className="row g6 t-xs"><Check size={13} color="var(--green)" />{place.accommodationReviewScore ?? place.accommodationRating ?? '-'} hodnocení</span>
                      <span className="row g6 t-xs"><Check size={13} color="var(--green)" />{place.accommodationReviewCount ?? 0} recenzí</span>
                    </div>
                    <div className="col flex1 g6">
                      {place.description ? <span className="row g6 t-xs muted"><Minus size={13} />{place.description}</span> : <span className="row g6 t-xs muted"><Minus size={13} />bez poznámky</span>}
                    </div>
                  </div>

                  <hr className="sep mt14" />
                  <div className="row g8 mt12 wrap">
                    <span className="badge solid"><Star size={12} />{stats.selected} vybráno</span>
                    <span className="badge"><ThumbsUp size={12} />{stats.shortlist} shortlist</span>
                    <span className="badge red"><ThumbsDown size={12} />{stats.against} proti</span>
                    <span className="badge muted tnum">score {stats.score}</span>
                  </div>
                  {missingNames.length > 0 && (
                    <div className="row g6 mt10 muted t-xs wrap">
                      <span>Chybí hlas:</span>
                      {missingNames.slice(0, 4).map((name) => <span className="badge muted" key={name}>{name}</span>)}
                      {missingNames.length > 4 && <span className="badge muted">+{missingNames.length - 4}</span>}
                    </div>
                  )}
                  <div className="row between mt12 g8 wrap">
                    <div className="row g8">
                      <span className="badge"><ThumbsUp size={12} />{stats.totalSupport}/{members}</span>
                      <span className="badge muted"><MessageCircle size={12} />{place.comments?.length ?? 0}</span>
                    </div>
                    {status === 'BOOKED' ? (
                      <span className={`badge ${accommodationStatusMeta.BOOKED.cls}`}><Check size={12} />{accommodationStatusMeta.BOOKED.label}</span>
                    ) : (
                      <div className="row g8 wrap">
                        <Button variant={stats.myVote === 'UP' ? 'secondary' : 'outline'} size="sm" type="button" onClick={() => onVotePlace?.(place.id, 'UP')}><ThumbsUp />Shortlist</Button>
                        <Button variant={stats.myVote === 'DOWN' ? 'secondary' : 'ghost'} size="sm" type="button" onClick={() => onVotePlace?.(place.id, 'DOWN')}><ThumbsDown />Proti</Button>
                        <Button size="sm" type="button" onClick={() => {
                          if (statusFlow.nextStatus === 'SELECTED') onVotePlace?.(place.id, 'MUST_HAVE');
                          else onStatusChange?.(place.id, statusFlow.nextStatus);
                        }}>
                          <Check />{statusFlow.actionLabel}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-[14px] shadow-[var(--sh-sm)] mb16">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(new FormData(event.currentTarget));
        }}
      >
        <div className="row between mb12">
          <span className="t-h3">Hledání ubytování</span>
          <span className="badge cat-stay"><BedDouble />Booking</span>
        </div>
        <Label htmlFor="stayDestination">Destinace</Label>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" id="stayDestination" name="stayDestination" defaultValue={trip?.destination ?? ''} placeholder="Barcelona" />
        </div>
        <div className="grid2" style={{ gap: 8 }}>
          <Input name="checkin" defaultValue={trip?.startsAt?.slice(0, 10) ?? ''} type="date" aria-label="Příjezd" />
          <Input name="checkout" defaultValue={trip?.endsAt?.slice(0, 10) ?? ''} type="date" aria-label="Odjezd" />
        </div>
        <div className="row g8 mt10">
          <Input name="adults" defaultValue={trip?.members?.length ?? 2} min={1} type="number" aria-label="Hosté" />
          <Button type="submit" disabled={searching}>{searching ? 'Hledám' : 'Hledat'}</Button>
        </div>
      </form>
      </Card>

      <div className="row between mb8">
        <span className="t-h2">{stays.length || 'Žádné'} výsledky</span>
        <span className="muted t-xs">Uložením vznikne kandidát</span>
      </div>

      {savedPlaces.length === 0 && stays.length === 0 && (
        <Card>
          <EmptyState icon={<BedDouble />} title="Vyhledej ubytování." text="Porovnej piny na mapě a ulož kandidáty." />
        </Card>
      )}

      {stays.map((stay, index) => (
        <div key={stay.externalId}>
          {index > 0 && <hr className="sep" />}
          <div className="row" style={{ padding: '12px 0', gap: 12 }}>
            <div className="receipt pressable" onClick={() => onSelect(stay.externalId)} style={{ width: 54, height: 54, borderRadius: 12, border: '1px solid var(--border)', flex: '0 0 auto' }} />
            <div className="col flex1 pressable" style={{ minWidth: 0 }} onClick={() => onSelect(stay.externalId)}>
              <span className="t-h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stay.name}</span>
              <span className="muted t-xs mt4 row g6">{stay.type ?? stay.provider}<span className="dotsep" /><span className="row g4" style={{ color: 'var(--fg)', fontWeight: 600 }}><Star />{stay.reviewScore ?? stay.rating ?? '-'}</span><span className="faint">({stay.reviewCount ?? 0})</span></span>
              <div className="row g4 mt6"><span className="t-h3 tnum">{stay.priceDisplay ?? `${stay.priceTotal ?? '-'} ${stay.currency ?? ''}`}</span></div>
            </div>
            <Button size="sm" variant={savedByExternalId.has(stay.externalId) || selectedId === stay.externalId ? 'secondary' : 'outline'} type="button" onClick={() => {
              const saved = savedByExternalId.get(stay.externalId);
              if (saved) onSelectSaved?.(saved.id);
              else onSave(stay);
            }}>
              {savedByExternalId.has(stay.externalId) ? <Check /> : <Plus />}{savedByExternalId.has(stay.externalId) ? 'Uloženo' : 'Uložit'}
            </Button>
            {stay.deepLinkUrl && (
              <Button asChild size="icon" variant="ghost" title="Otevřít poskytovatele">
                <a href={stay.deepLinkUrl} target="_blank" rel="noreferrer"><ExternalLink /></a>
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
