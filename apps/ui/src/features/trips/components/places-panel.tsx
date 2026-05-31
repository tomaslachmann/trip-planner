import { MapPin, Plus, Search } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Place, Trip } from '../types';
import { PlaceRow } from './place-row';

function DraggablePlace({ place, onSelect, onAdd, selected }: { place: Place; onSelect: () => void; onAdd: () => void; selected?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `place:${place.id}` });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={isDragging ? 'dragging' : undefined}
      {...listeners}
      {...attributes}
    >
      <PlaceRow place={place} selected={selected} dragging={isDragging} onSelect={onSelect} onAdd={onAdd} />
    </div>
  );
}

export function PlacesPanel({
  trip,
  places,
  selectedPlaceId,
  onSelect,
  onAddPlace,
  onPlanPlace,
}: {
  trip?: Trip;
  places: Place[];
  selectedPlaceId?: string;
  onSelect: (placeId: string) => void;
  onAddPlace: (data: FormData) => void;
  onPlanPlace: (placeId: string) => void;
}) {
  return (
    <div className="scroll px18" style={{ flex: 1, paddingTop: 10, paddingBottom: 18 }}>
      <form
        className="card pad sh mb16"
        onSubmit={(event) => {
          event.preventDefault();
          onAddPlace(new FormData(event.currentTarget));
          event.currentTarget.reset();
        }}
      >
        <div className="row between mb12">
          <span className="t-h3">Přidat místo</span>
          <span className="badge muted">{trip?.destination ?? 'Trip'}</span>
        </div>
        <label className="field-label" htmlFor="placeName">Název</label>
        <div className="input mb10"><Search /><input id="placeName" name="placeName" placeholder="Sagrada Familia, nádraží..." /></div>
        <div className="grid2" style={{ gridTemplateColumns: '1.2fr .8fr', gap: 8 }}>
          <select className="input" name="placeType" defaultValue="PLACE" aria-label="Typ místa">
            <option value="PLACE">Místo</option>
            <option value="FOOD">Jídlo</option>
            <option value="ACTIVITY">Aktivita</option>
            <option value="DAY_TRIP">Výlet</option>
            <option value="TRANSPORT">Doprava</option>
            <option value="ACCOMMODATION">Ubytování</option>
          </select>
          <button className="btn primary" type="submit"><Plus />Přidat</button>
        </div>
        <input name="latitude" type="hidden" value="41.4036" />
        <input name="longitude" type="hidden" value="2.1744" />
      </form>

      <div className="row between mb8">
        <span className="t-h2">{places.length} míst</span>
        <span className="badge"><MapPin />Přetáhni do plánu</span>
      </div>
      {places.length === 0 && (
        <div className="card pad center muted">
          <div className="empty-ic jcc" style={{ margin: '0 auto 10px' }}><MapPin /></div>
          <span className="t-sm">Zatím tu nejsou žádná místa. Přidej první nahoře.</span>
        </div>
      )}
      {places.map((place, index) => (
        <div key={place.id}>
          {index > 0 && <hr className="sep" />}
          <DraggablePlace
            place={place}
            selected={selectedPlaceId === place.id}
            onSelect={() => onSelect(place.id)}
            onAdd={() => onPlanPlace(place.id)}
          />
        </div>
      ))}
    </div>
  );
}
