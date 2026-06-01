import { BedDouble, Check, ExternalLink, Link2, MapPin, MessageCircle, Minus, Plus, Search, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ValidatedForm } from '@/components/ui/validated-form';
import { accommodationStatusMeta, getAccommodationSummary, type AccommodationStatus, type AccommodationVoteValue } from '../lib/accommodation-scoring';
import { bookingDetailUrl } from '../lib/booking-links';
import { accommodationRecommendationScore, distanceMeters, topPlaces } from '../lib/decision';
import { externalMapUrl } from '../lib/map-links';
import type { Accommodation, LocationResult, Place, Trip } from '../types';
import { AccommodationPhoto, AccommodationRatingBadge, accommodationPriceLabel, accommodationTypeLabel } from './accommodation-display';
import { LocationCombobox } from './location-combobox';
import { PlaceImage } from './place-image';
import { ScoreBadge } from './place-score-badge';
import { StatusActionButton } from './status-action-button';

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

function nextDateInput(value?: string) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function sourceLabel(place: Place) {
  try {
    const url = new URL(bookingDetailUrl(place) ?? place.accommodationProvider ?? '');
    return url.hostname.replace(/^www\./, '');
  } catch {
    return place.accommodationProvider ?? 'odkaz';
  }
}

export function StayPanel({
  trip,
  stays,
  savedPlaces = [],
  allPlaces = savedPlaces,
  actorUserId,
  selectedId,
  hasSearched = false,
  searching,
  layout = 'panel',
  onSearch,
  onSearchLocations,
  onManualAdd,
  onSelect,
  onSave,
  onSelectSaved,
  onVotePlace,
  onStatusChange,
}: {
  trip?: Trip;
  stays: Accommodation[];
  savedPlaces?: Place[];
  allPlaces?: Place[];
  actorUserId?: string;
  selectedId?: string;
  hasSearched?: boolean;
  searching: boolean;
  layout?: 'panel' | 'desktop';
  onSearch: (data: FormData) => void;
  onSearchLocations?: (query: string) => Promise<LocationResult[]>;
  onManualAdd?: () => void;
  onSelect: (id: string) => void;
  onSave: (stay: Accommodation) => void;
  onSelectSaved?: (id: string) => void;
  onVotePlace?: (placeId: string, value: AccommodationVoteValue) => void;
  onStatusChange?: (placeId: string, status: AccommodationStatus) => void;
}) {
  const [mode, setMode] = useState<'select' | 'search'>(savedPlaces.length > 0 ? 'select' : 'search');
  const defaultCheckin = trip?.startsAt?.slice(0, 10) ?? '';
  const defaultCheckout = trip?.endsAt?.slice(0, 10) ?? '';
  const [checkin, setCheckin] = useState(defaultCheckin);
  const [checkout, setCheckout] = useState(defaultCheckout);
  const tripMembers = trip?.members ?? [];
  const members = Math.max(1, tripMembers.length || 1);
  const summaries = new Map(savedPlaces.map((place) => [place.id, getAccommodationSummary(place, tripMembers, actorUserId)]));
  const rankedSavedPlaces = savedPlaces
    .map((place) => ({ place, score: accommodationRecommendationScore(place, allPlaces, tripMembers) }))
    .sort((a, b) => b.score - a.score);
  const referencePlaces = topPlaces(allPlaces.filter((place) => place.type !== 'ACCOMMODATION'), tripMembers, 5).map(({ place }) => place);
  const selectedCount = savedPlaces.filter((place) => ['SELECTED', 'BOOKED'].includes(summaries.get(place.id)?.status ?? 'SAVED')).length;
  const shortlistCount = savedPlaces.filter((place) => summaries.get(place.id)?.status === 'SHORTLISTED').length;
  const rejectedCount = savedPlaces.filter((place) => summaries.get(place.id)?.status === 'REJECTED').length;
  const savedByExternalId = new Map(savedPlaces.map((place) => [place.accommodationExternalId, place]));
  const searchByExternalId = new Map(stays.map((stay) => [stay.externalId, stay]));

  useEffect(() => {
    setCheckin(defaultCheckin);
    setCheckout(defaultCheckout);
  }, [defaultCheckin, defaultCheckout, trip?.id]);

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
        <Card className="p-[12px]" style={{ background: 'var(--subtle)' }}><span className="faint t-xs">Užší výběr</span><div className="t-h2 tnum mt4">{shortlistCount}</div></Card>
        <Card className="p-[12px]" style={{ background: 'var(--subtle)' }}><span className="faint t-xs">Proti</span><div className="t-h2 tnum mt4">{rejectedCount}</div></Card>
      </div>

      <div className="row g8 mb16" style={{ alignItems: 'stretch' }}>
        <SegmentedControl
          className="flex1"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'select', label: 'Výběr' },
            { value: 'search', label: 'Hledání' },
          ]}
        />
        {onManualAdd && (
          <Button type="button" onClick={onManualAdd}>
            <Plus />Přidat
          </Button>
        )}
      </div>

      {mode === 'select' && savedPlaces.length > 0 && (
        <div className={layout === 'desktop' ? 'grid3 mb16' : 'col g12 mb16'}>
          {rankedSavedPlaces.map(({ place, score }, index) => {
            const summary = summaries.get(place.id) ?? getAccommodationSummary(place, tripMembers, actorUserId);
            const { stats, status, statusMeta: meta, statusFlow } = summary;
            const total = typeof place.estimatedCost === 'string' ? Number(place.estimatedCost) : place.estimatedCost;
            const perPerson = total && Number.isFinite(total) ? total / members : undefined;
            const currency = currencyFor(trip, place);
            const missingNames = stats.missingVoters.map((member) => member.user.name);
            const averageDistance = referencePlaces.length
              ? Math.round(referencePlaces.reduce((sum, item) => sum + distanceMeters(place, item), 0) / referencePlaces.length)
              : null;
            const searchStay = place.accommodationExternalId ? searchByExternalId.get(place.accommodationExternalId) : undefined;
            const displayPlace = searchStay?.photoUrl && !place.imageUrl ? { ...place, imageUrl: searchStay.photoUrl } : place;
            const mapUrl = externalMapUrl(place);
            const bookingUrl = (searchStay ? bookingDetailUrl(searchStay, trip) : undefined) ?? bookingDetailUrl(place, trip);
            return (
              <Card className="shadow-[var(--sh-sm)] overflow-hidden" key={place.id}>
                <PlaceImage place={displayPlace} height={layout === 'desktop' ? 108 : 120} style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: 0 }} />
                <div className="p16">
                  <div className="row between g10">
                    <div className="col flex1" style={{ minWidth: 0 }}>
                      <button className="t-h2 ellipsis text-left" type="button" onClick={() => onSelectSaved?.(place.id)}>{place.name}</button>
                      <span className="row g4 muted t-xs mt4" style={{ color: 'var(--c-see)' }}><Link2 size={12} />{sourceLabel(place)}</span>
                    </div>
                    <div className="row g6 wrap" style={{ justifyContent: 'flex-end' }}>
                      {index === 0 && <span className="badge green">Doporučeno</span>}
                      <ScoreBadge score={score} title="Skóre ubytování" />
                      <span className={`badge ${meta.cls}`}>{meta.label}</span>
                    </div>
                  </div>
                  {(mapUrl || bookingUrl) && (
                    <div className="row g6 mt10 wrap">
                      {mapUrl && (
                        <Button asChild variant="outline" size="sm" title="Otevřít v mapě">
                          <a href={mapUrl} target="_blank" rel="noreferrer"><MapPin />Mapa</a>
                        </Button>
                      )}
                      {bookingUrl && (
                        <Button asChild variant="outline" size="sm" title="Otevřít ubytování">
                          <a href={bookingUrl} target="_blank" rel="noreferrer"><ExternalLink />Booking</a>
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="grid3 mt12">
                    <Card className="center p-[8px]" style={{ background: 'var(--subtle)' }}><div className="t-h3 tnum">{money(total, currency)}</div><div className="faint t-xs">celkem</div></Card>
                    <Card className="center p-[8px]" style={{ background: 'var(--subtle)' }}><div className="t-h3 tnum">{money(perPerson, currency)}</div><div className="faint t-xs">osoba</div></Card>
                    <Card className="center p-[8px]" style={{ background: 'var(--subtle)' }}><div className="t-h3">{tripNights(trip, place)}</div><div className="faint t-xs">nocí</div></Card>
                  </div>

                  <div className="row g14 mt12" style={{ alignItems: 'flex-start' }}>
                    <div className="col flex1 g6">
                      <AccommodationRatingBadge
                        className="w-fit"
                        reviewScore={place.accommodationReviewScore}
                        rating={place.accommodationRating}
                        reviewCount={place.accommodationReviewCount}
                      />
                      <span className="row g6 t-xs"><Check size={13} color="var(--green)" />{place.accommodationReviewCount ?? 0} recenzí</span>
                      <span className="row g6 t-xs"><Check size={13} color="var(--green)" />{averageDistance === null ? 'není top cíl' : `${(averageDistance / 1000).toFixed(1)} km od top míst`}</span>
                    </div>
                    <div className="col flex1 g6">
                      {place.description ? <span className="row g6 t-xs muted"><Minus size={13} />{place.description}</span> : <span className="row g6 t-xs muted"><Minus size={13} />bez poznámky</span>}
                    </div>
                  </div>

                  <hr className="sep mt14" />
                  <div className="row g8 mt12 wrap">
                    <span className="badge solid"><Star size={12} />{stats.selected} vybráno</span>
                    <span className="badge"><ThumbsUp size={12} />{stats.shortlist} v užším výběru</span>
                    <span className="badge red"><ThumbsDown size={12} />{stats.against} proti</span>
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
                        <StatusActionButton active={stats.myVote === 'UP' || status === 'SHORTLISTED'} tone="amber" size="sm" type="button" onClick={() => onVotePlace?.(place.id, 'UP')}><ThumbsUp />Užší výběr</StatusActionButton>
                        <StatusActionButton active={stats.myVote === 'DOWN' || status === 'REJECTED'} tone="red" variant={stats.myVote === 'DOWN' || status === 'REJECTED' ? 'outline' : 'ghost'} size="sm" type="button" onClick={() => onVotePlace?.(place.id, 'DOWN')}><ThumbsDown />Proti</StatusActionButton>
                        {onStatusChange && (
                          <StatusActionButton active={status === 'SELECTED'} tone="green" size="sm" type="button" onClick={() => onStatusChange(place.id, statusFlow.nextStatus)}>
                            <Check />{statusFlow.actionLabel}
                          </StatusActionButton>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {mode === 'select' && savedPlaces.length === 0 && (
        <Card>
          <EmptyState icon={<BedDouble />} title="Zatím není vybrané ubytování." text="Vyhledej ubytování, nebo přidej kandidáta ručně." />
        </Card>
      )}

      {mode === 'search' && (
        <>
          <Card className="p-[14px] shadow-[var(--sh-sm)] mb16">
            <ValidatedForm
              onSubmit={(event) => {
                event.preventDefault();
                onSearch(new FormData(event.currentTarget));
              }}
            >
              <div className="row between mb12">
                <span className="t-h3">Hledání ubytování</span>
                <span className="badge cat-stay"><BedDouble />Booking</span>
              </div>
              <Label>Destinace</Label>
              <div className="mb-3">
                {onSearchLocations ? (
                  <LocationCombobox defaultLabel={trip?.destination ?? ''} onSearch={onSearchLocations} />
                ) : (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" name="stayDestination" defaultValue={trip?.destination ?? ''} placeholder="Barcelona" required />
                  </div>
                )}
              </div>
              <div className="grid2" style={{ gap: 8 }}>
                <Input
                  name="checkin"
                  value={checkin}
                  max={checkout || undefined}
                  type="date"
                  aria-label="Příjezd"
                  onChange={(event) => setCheckin(event.target.value)}
                  required
                />
                <Input
                  name="checkout"
                  value={checkout}
                  min={nextDateInput(checkin) || undefined}
                  type="date"
                  aria-label="Odjezd"
                  data-after-field="checkin"
                  data-after-strict="true"
                  data-after-message="Odjezd musí být po příjezdu."
                  onChange={(event) => setCheckout(event.target.value)}
                  required
                />
              </div>
              <div className="grid2 mt8" style={{ gap: 8 }}>
                <Input name="minPrice" min={0} step={10} type="number" aria-label="Cena od" placeholder={`Cena od (${trip?.currency ?? 'EUR'})`} />
                <Input name="maxPrice" min={0} step={10} type="number" aria-label="Cena do" placeholder={`Cena do (${trip?.currency ?? 'EUR'})`} />
              </div>
              <div className="row g8 mt10">
                <Input name="adults" defaultValue={trip?.members?.length ?? 2} min={1} type="number" aria-label="Hosté" required />
                <Button type="submit" disabled={searching}>{searching ? 'Hledám' : 'Hledat'}</Button>
              </div>
            </ValidatedForm>
          </Card>

          <div className="row between mb8">
            <span className="t-h2">{stays.length || 'Žádné'} výsledky</span>
            <span className="muted t-xs">Uložením vznikne kandidát</span>
          </div>

          {stays.length === 0 && (
            <Card>
              <EmptyState
                icon={<Search />}
                title={hasSearched ? 'Nic jsem nenašel.' : 'Vyhledej ubytování.'}
                text={hasSearched ? 'Zkus upravit destinaci, termín nebo cenový rozsah.' : 'Porovnej výsledky a ulož kandidáty do výběru.'}
              />
            </Card>
          )}

      {stays.map((stay, index) => (
        (() => {
          const saved = savedByExternalId.get(stay.externalId);
          const displayStay = { ...stay, photoUrl: stay.photoUrl ?? saved?.imageUrl ?? undefined };
          const mapUrl = externalMapUrl(stay);
          const bookingUrl = bookingDetailUrl(stay, trip);
          return (
            <div key={stay.externalId}>
              {index > 0 && <hr className="sep" />}
              <div className="row" style={{ padding: '12px 0', gap: 12 }}>
                <AccommodationPhoto className="pressable" stay={displayStay} onClick={() => onSelect(stay.externalId)} />
                <div className="col flex1 pressable" style={{ minWidth: 0 }} onClick={() => onSelect(stay.externalId)}>
                  <span className="t-h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stay.name}</span>
                  <span className="muted t-xs mt4 row g6 wrap">
                    {accommodationTypeLabel(stay)}
                    <span className="dotsep" />
                    <AccommodationRatingBadge compact reviewScore={stay.reviewScore} rating={stay.rating} reviewCount={stay.reviewCount} />
                  </span>
                  <div className="row g4 mt6"><span className="t-h3 tnum">{accommodationPriceLabel(stay)}</span></div>
                  {(mapUrl || bookingUrl) && (
                    <div className="row g6 mt8 wrap">
                      {mapUrl && (
                        <Button asChild size="sm" variant="ghost" title="Otevřít v mapě">
                          <a href={mapUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><MapPin />Mapa</a>
                        </Button>
                      )}
                      {bookingUrl && (
                        <Button asChild size="sm" variant="ghost" title="Otevřít ubytování">
                          <a href={bookingUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><ExternalLink />Booking</a>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <Button size="sm" variant={savedByExternalId.has(stay.externalId) || selectedId === stay.externalId ? 'secondary' : 'outline'} type="button" onClick={() => {
                  if (saved) onSelectSaved?.(saved.id);
                  else onSave(stay);
                }}>
                  {savedByExternalId.has(stay.externalId) ? <Check /> : <Plus />}{savedByExternalId.has(stay.externalId) ? 'Uloženo' : 'Uložit'}
                </Button>
              </div>
            </div>
          );
        })()
      ))}
        </>
      )}
    </div>
  );
}
