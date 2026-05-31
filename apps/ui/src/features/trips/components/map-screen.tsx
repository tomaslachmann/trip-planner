import { ArrowUpDown, Banknote, BedDouble, ChevronRight, Clock, LocateFixed, MapPin, MessageCircle, Search, Star, ThumbsUp, X } from 'lucide-react';
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { AvatarRow } from './avatar';
import { CategoryBadge } from './category';
import { MapCanvas } from './map-canvas';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import type { Place } from '../types';

const filters = [
  { key: 'ALL', label: 'Vše' },
  { key: 'PLACE', label: 'Památky' },
  { key: 'FOOD', label: 'Jídlo' },
  { key: 'ACTIVITY', label: 'Aktivity' },
  { key: 'DAY_TRIP', label: 'Výlety' },
  { key: 'ACCOMMODATION', label: 'Ubytování' },
  { key: 'TRANSPORT', label: 'Doprava' },
];

type Snap = 'peek' | 'half' | 'full';
const snapHeights: Record<Snap, number> = { peek: 0.18, half: 0.52, full: 0.9 };

function votes(place: Place) {
  const values = place.votes ?? [];
  return {
    must: values.filter((vote) => vote.value === 'MUST_HAVE').length,
    up: values.filter((vote) => vote.value === 'UP').length,
    maybe: values.filter((vote) => vote.value === 'MAYBE').length,
  };
}

export function MapScreen({ planner, desktop = false }: { planner: TripPlannerController; desktop?: boolean }) {
  const { state, actions } = planner;
  const [filter, setFilter] = useState('ALL');
  const [snap, setSnap] = useState<Snap>('half');
  const [detailOpen, setDetailOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ y: number; height: number; viewport: number } | null>(null);
  const showStays = filter === 'ACCOMMODATION';
  const filteredPlaces = useMemo(() => {
    if (filter === 'ALL') return state.data.places;
    return state.data.places.filter((place) => place.type === filter || (filter === 'PLACE' && place.type === 'CUSTOM'));
  }, [filter, state.data.places]);

  function startSheetDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!sheetRef.current) return;
    const viewport = sheetRef.current.parentElement?.clientHeight ?? window.innerHeight;
    dragRef.current = { y: event.clientY, height: sheetRef.current.offsetHeight, viewport };
    sheetRef.current.style.transition = 'none';
    window.addEventListener('pointermove', moveSheet);
    window.addEventListener('pointerup', stopSheetDrag);
  }

  function moveSheet(event: PointerEvent) {
    if (!dragRef.current || !sheetRef.current) return;
    const deltaY = dragRef.current.y - event.clientY;
    const nextHeight = Math.max(78, Math.min(dragRef.current.viewport * 0.92, dragRef.current.height + deltaY));
    sheetRef.current.style.height = `${nextHeight}px`;
  }

  function stopSheetDrag() {
    if (!dragRef.current || !sheetRef.current) return;
    const fraction = sheetRef.current.offsetHeight / dragRef.current.viewport;
    const nearest = (Object.entries(snapHeights) as Array<[Snap, number]>).sort((a, b) => Math.abs(a[1] - fraction) - Math.abs(b[1] - fraction))[0][0];
    sheetRef.current.style.transition = '';
    sheetRef.current.style.height = '';
    setSnap(nearest);
    dragRef.current = null;
    window.removeEventListener('pointermove', moveSheet);
    window.removeEventListener('pointerup', stopSheetDrag);
  }

  function selectPlace(placeId: string) {
    actions.setSelectedPlaceId(placeId);
    setSnap('peek');
    setDetailOpen(false);
    setCommentText('');
  }

  function selectStay(stayId: string) {
    actions.setSelectedAccommodationId(stayId);
    setSnap('peek');
  }

  function setMapFilter(next: string) {
    setFilter(next);
    setSnap('half');
    if (next === 'ACCOMMODATION' && state.accommodations.length === 0) void actions.searchStays();
  }

  const placeList = filteredPlaces.length ? filteredPlaces : state.data.places;
  const selectedVotes = state.selectedPlace ? votes(state.selectedPlace) : null;
  const myVote = state.selectedPlace?.votes?.find((vote) => vote.userId === state.actorUserId)?.value;
  const hasCommentDraft = commentText.trim().length > 0;

  return (
    <div className={desktop ? 'desktop-map-host' : 'screen'}>
      <MapCanvas
        places={placeList}
        accommodations={state.accommodations}
        routes={state.data.routes}
        selectedPlaceId={state.selectedPlaceId}
        selectedAccommodationId={state.selectedAccommodationId}
        onPlaceSelect={selectPlace}
        onAccommodationSelect={selectStay}
        showStays={showStays}
      >
        <div className="float-top">
          <div className="searchbar">
            {showStays ? <BedDouble /> : <Search />}
            <span className="muted flex1" style={{ fontSize: 15 }}>
              {showStays ? 'Ubytování v aktuální oblasti' : `Hledat místa v destinaci ${state.selectedTrip?.destination ?? 'tomto tripu'}...`}
            </span>
            <AvatarRow names={(state.selectedTrip?.members ?? []).map((member) => member.user.name)} />
          </div>
          <div className="chips mt10">
            {filters.map((item) => (
              <button className={`chip ${filter === item.key ? 'on' : ''}`} key={item.key} type="button" onClick={() => setMapFilter(item.key)}>{item.label}</button>
            ))}
          </div>
        </div>

        {showStays && <button className="search-area" type="button" onClick={() => void actions.searchStays()}><ArrowUpDown />Hledat v této oblasti</button>}

        <button className="fab" style={{ bottom: desktop ? 24 : `calc(${snapHeights[snap] * 100}% + 16px)` }} type="button" title="Najít polohu"><LocateFixed /></button>

        {!desktop && (
          <div ref={sheetRef} className="docksheet" style={{ height: `${snapHeights[snap] * 100}%` }}>
            <div onPointerDown={startSheetDrag} style={{ cursor: 'grab', flex: '0 0 auto', touchAction: 'none' }}>
              <div className="grabber" />
            </div>
            {snap === 'peek' && (
              <div className={showStays ? 'p18' : 'p18 pressable'} style={{ paddingTop: 4 }} onClick={() => !showStays && state.selectedPlace && setDetailOpen(true)}>
                {showStays && state.selectedAccommodation ? (
                <>
                  <div className="row between mb10">
                    <span className="badge cat-stay"><BedDouble />{state.selectedAccommodation.type ?? state.selectedAccommodation.provider}</span>
                    <span className="badge">{state.selectedAccommodation.reviewScore ?? state.selectedAccommodation.rating ?? '-'} hodnocení</span>
                  </div>
                  <div className="row g12">
                    <div className="receipt" style={{ width: 64, height: 64, borderRadius: 12, border: '1px solid var(--border)', flex: '0 0 auto' }} />
                    <div className="col flex1">
                      <span className="t-h2">{state.selectedAccommodation.name}</span>
                      <span className="muted t-sm mt4">{state.selectedAccommodation.priceDisplay ?? `${state.selectedAccommodation.priceTotal ?? '-'} ${state.selectedAccommodation.currency ?? ''}`}</span>
                    </div>
                  </div>
                  <button className="btn primary block mt14" type="button" onClick={() => void actions.saveAccommodation(state.selectedAccommodation!)}>Uložit ubytování</button>
                </>
              ) : state.selectedPlace ? (
                <>
                  <div className="row between mb8">
                    <CategoryBadge type={state.selectedPlace.type} />
                    <span className="badge muted">{state.selectedPlace.votes?.length ?? 0} hlasů</span>
                  </div>
                  <div className="row between">
                    <div className="col">
                      <span className="t-h2">{state.selectedPlace.name}</span>
                      <span className="muted t-sm mt4">{state.selectedPlace.durationMin ?? 90} min · {state.selectedPlace.estimatedCost ?? 'Zdarma'}</span>
                    </div>
                    <ChevronRight className="faint" />
                  </div>
                  {selectedVotes && (
                    <div className="row g8 mt14">
                      <span className="badge solid"><Star />{selectedVotes.must} must</span>
                      <span className="badge"><ThumbsUp />{selectedVotes.up} pro</span>
                      <span className="badge muted">{selectedVotes.maybe} možná</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="center muted t-sm">Klepni na pin nebo přidej místa v plánu.</div>
              )}
              </div>
            )}
            {snap !== 'peek' && showStays && (
              <>
                <div className="px18" style={{ flex: '0 0 auto' }}>
                  <div className="row between" style={{ padding: '2px 0 6px' }}>
                    <span className="t-h2">{state.accommodations.length} ubytování v okolí</span>
                    <button className="btn ghost sm" type="button" onClick={() => void actions.searchStays()}><ArrowUpDown />Cena</button>
                  </div>
                  <span className="muted t-xs">Výsledky z napojeného vyhledávání ubytování.</span>
                </div>
                <div className="scroll px18" style={{ flex: 1, paddingTop: 6, paddingBottom: 18 }}>
                  {state.accommodations.map((stay, index) => (
                    <div key={stay.externalId}>
                      {index > 0 && <hr className="sep" />}
                      <button className="map-list-row" type="button" onClick={() => selectStay(stay.externalId)}>
                        <div className="receipt" style={{ width: 54, height: 54, borderRadius: 12, border: '1px solid var(--border)', flex: '0 0 auto' }} />
                        <div className="col flex1" style={{ minWidth: 0 }}>
                          <span className="t-h3 ellipsis">{stay.name}</span>
                          <span className="muted t-xs mt4">{stay.type ?? stay.provider} · {stay.reviewScore ?? stay.rating ?? '-'} hodnocení</span>
                          <span className="t-h3 tnum mt4">{stay.priceDisplay ?? `${stay.priceTotal ?? '-'} ${stay.currency ?? ''}`}</span>
                        </div>
                      </button>
                    </div>
                  ))}
                  {state.accommodations.length === 0 && <button className="btn primary block mt14" type="button" onClick={() => void actions.searchStays()}>Najít ubytování</button>}
                </div>
              </>
            )}
            {snap !== 'peek' && !showStays && (
              <>
                <div className="px18" style={{ flex: '0 0 auto' }}>
                  <div className="row between" style={{ padding: '2px 0 12px' }}>
                    <span className="t-h2">{placeList.length} míst</span>
                    <button className="btn ghost sm" type="button" onClick={() => void actions.optimizeRoute()}><ArrowUpDown />Trasa</button>
                  </div>
                </div>
                <div className="scroll px18" style={{ flex: 1, paddingBottom: 18 }}>
                  {placeList.map((place, index) => {
                    const itemVotes = votes(place);
                    return (
                      <div key={place.id}>
                        {index > 0 && <hr className="sep" />}
                        <button className="map-list-row" type="button" onClick={() => {
                          selectPlace(place.id);
                          setDetailOpen(true);
                        }}>
                          <div className="col flex1" style={{ minWidth: 0 }}>
                            <div className="row between g8">
                              <span className="t-h3 ellipsis">{place.name}</span>
                              <CategoryBadge type={place.type} />
                            </div>
                            <div className="row g10 mt4 muted t-xs">
                              <span><ThumbsUp /> {itemVotes.must + itemVotes.up}</span>
                              <span>{place.comments?.length ?? 0} komentářů</span>
                              <span>{place.durationMin ?? 90} min</span>
                              <span className="medi" style={{ color: 'var(--fg)' }}>{place.estimatedCost ?? 'Zdarma'}</span>
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
        {!desktop && detailOpen && state.selectedPlace && (
          <>
            <div className="scrim" onClick={() => setDetailOpen(false)} />
            <div className="sheet" style={{ height: '92%' }}>
              <div className="sheet-head" style={{ paddingBottom: 6 }}>
                <div className="row g8">
                  <CategoryBadge type={state.selectedPlace.type} />
                  <span className="badge muted">{state.selectedPlace.votes?.length ?? 0} hlasů</span>
                </div>
                <button className="iconbtn plain" type="button" onClick={() => setDetailOpen(false)}><X /></button>
              </div>
              <div className="scroll px18" style={{ flex: 1 }}>
                <div className="receipt center" style={{ height: 150, borderRadius: 14, border: '1px solid var(--border)' }}>
                  <span className="row g6 t-xs mono muted"><MapPin />fotka místa</span>
                </div>
                <h2 className="t-title mt16">{state.selectedPlace.name}</h2>
                <div className="row g10 mt8 muted t-sm wrap">
                  <span className="row g4"><Clock />{state.selectedPlace.durationMin ?? 90} min</span>
                  <span className="row g4"><Banknote />{state.selectedPlace.estimatedCost ?? 'Zdarma'}</span>
                  <span className="row g4"><MapPin />{state.selectedTrip?.destination ?? 'Destinace'}</span>
                </div>
                {state.selectedPlace.sourceUrl && <p className="t-body mt14" style={{ color: '#3f3f46' }}>{state.selectedPlace.sourceUrl}</p>}
                <hr className="sep mt20" />
                <div className="row between mt16 mb10">
                  <span className="t-h3">Hlasování skupiny</span>
                  <span className="muted t-xs">{state.selectedPlace.votes?.length ?? 0} hlasů</span>
                </div>
                {selectedVotes && (
                  <div className="votes">
                    <button className={`votebtn ${myVote === 'MUST_HAVE' ? 'on must' : ''}`} type="button" onClick={() => void actions.voteForPlace(state.selectedPlace!.id, 'MUST_HAVE')}><span className="vn tnum">{selectedVotes.must}</span><span className="row g4"><Star />Nutné</span></button>
                    <button className={`votebtn ${myVote === 'UP' ? 'on' : ''}`} type="button" onClick={() => void actions.voteForPlace(state.selectedPlace!.id, 'UP')}><span className="vn tnum">{selectedVotes.up}</span><span className="row g4"><ThumbsUp />Pro</span></button>
                    <button className={`votebtn ${myVote === 'MAYBE' ? 'on' : ''}`} type="button" onClick={() => void actions.voteForPlace(state.selectedPlace!.id, 'MAYBE')}><span className="vn tnum">{selectedVotes.maybe}</span><span>Možná</span></button>
                  </div>
                )}
                <hr className="sep mt20" />
                <div className="row between mt16 mb12"><span className="t-h3">Komentáře</span><span className="badge muted">{state.selectedPlace.comments?.length ?? 0}</span></div>
                <div className="col g12">
                  {(state.selectedPlace.comments ?? []).map((comment) => (
                    <div className="card p14" key={comment.id ?? `${comment.userId}-${comment.body}`}>
                      <span className="t-sm">{comment.body}</span>
                    </div>
                  ))}
                </div>
                <div className="input muted-bg mt8" style={{ marginBottom: 18 }}>
                  <MessageCircle />
                  <input placeholder="Přidat komentář..." value={commentText} onChange={(event) => setCommentText(event.target.value)} />
                </div>
              </div>
              <div className="row g8 p16" style={{ borderTop: '1px solid var(--border)', flex: '0 0 auto' }}>
                <button className="btn primary flex1" type="button" onClick={() => {
                  if (hasCommentDraft) {
                    void actions.commentOnPlace(state.selectedPlace!.id, commentText).then(() => setCommentText(''));
                    return;
                  }
                  setDetailOpen(false);
                  void actions.addPlaceToItinerary(state.selectedPlace!.id);
                }}>{hasCommentDraft ? 'Přidat komentář' : 'Přidat do itineráře'}</button>
                <button className="btn outline icon" type="button" onClick={() => void actions.commentOnPlace(state.selectedPlace!.id, commentText).then(() => setCommentText(''))} disabled={!hasCommentDraft}><MessageCircle /></button>
              </div>
            </div>
          </>
        )}
      </MapCanvas>
    </div>
  );
}
