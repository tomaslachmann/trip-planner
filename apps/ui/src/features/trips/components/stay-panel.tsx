import { BedDouble, ExternalLink, Plus, Search, Star } from 'lucide-react';
import type { Accommodation, Trip } from '../types';

export function StayPanel({
  trip,
  stays,
  selectedId,
  searching,
  onSearch,
  onSelect,
  onSave,
}: {
  trip?: Trip;
  stays: Accommodation[];
  selectedId?: string;
  searching: boolean;
  onSearch: (data: FormData) => void;
  onSelect: (id: string) => void;
  onSave: (stay: Accommodation) => void;
}) {
  return (
    <div className="scroll px18" style={{ flex: 1, paddingTop: 10, paddingBottom: 18 }}>
      <form
        className="card pad sh mb16"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(new FormData(event.currentTarget));
        }}
      >
        <div className="row between mb12">
          <span className="t-h3">Hledání ubytování</span>
          <span className="badge cat-stay"><BedDouble />Booking</span>
        </div>
        <label className="field-label" htmlFor="stayDestination">Destinace</label>
        <div className="input mb10"><Search /><input id="stayDestination" name="stayDestination" defaultValue={trip?.destination ?? ''} placeholder="Barcelona" /></div>
        <div className="grid2" style={{ gap: 8 }}>
          <input className="input" name="checkin" defaultValue={trip?.startsAt?.slice(0, 10) ?? ''} type="date" aria-label="Příjezd" />
          <input className="input" name="checkout" defaultValue={trip?.endsAt?.slice(0, 10) ?? ''} type="date" aria-label="Odjezd" />
        </div>
        <div className="row g8 mt10">
          <input className="input" name="adults" defaultValue={trip?.members?.length ?? 2} min={1} type="number" aria-label="Hosté" />
          <button className="btn primary" type="submit" disabled={searching}>{searching ? 'Hledám' : 'Hledat'}</button>
        </div>
      </form>

      <div className="row between mb8">
        <span className="t-h2">{stays.length || 'Žádné'} ubytování</span>
        <span className="muted t-xs">Piny se zobrazí na mapě</span>
      </div>

      {stays.length === 0 && (
        <div className="card pad center muted">
          <div className="empty-ic jcc" style={{ margin: '0 auto 10px' }}><BedDouble /></div>
          <span className="t-sm">Vyhledej ubytování, porovnej piny a ulož kandidáty.</span>
        </div>
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
            <button className={`btn sm ${selectedId === stay.externalId ? 'secondary' : 'outline'}`} type="button" onClick={() => onSave(stay)}>
              <Plus />Uložit
            </button>
            {stay.deepLinkUrl && (
              <a className="btn ghost sm icon" href={stay.deepLinkUrl} target="_blank" rel="noreferrer" title="Otevřít poskytovatele"><ExternalLink /></a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
