import { BedDouble, MapPin, Receipt, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { TripIconButton } from './design-system';

export function AddMenu({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (target: 'place' | 'stay' | 'expense') => void;
}) {
  const items = [
    { key: 'place' as const, title: 'Přidat místo', text: 'Vyhledej místo nebo přidej pin do mapy', icon: MapPin, color: 'see' },
    { key: 'stay' as const, title: 'Najít ubytování', text: 'Vyhledej kandidáty přes Booking', icon: BedDouble, color: 'stay' },
    { key: 'expense' as const, title: 'Přidat náklad', text: 'Rozděl mezi všechny nebo vybrané lidi', icon: Receipt, color: 'food' },
  ];
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent style={{ height: 'auto' }}>
        <div className="grabber" />
        <div className="sheet-head">
          <SheetTitle className="t-h3">Přidat do tripu</SheetTitle>
          <TripIconButton plain type="button" onClick={onClose}><X /></TripIconButton>
        </div>
        <div className="px18" style={{ paddingBottom: 22 }}>
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.key}>
                {index > 0 && <hr className="sep" />}
                <button className="row pressable full" style={{ padding: '13px 0', border: 0, background: 'transparent', textAlign: 'left' }} type="button" onClick={() => onPick(item.key)}>
                  <span className="lead-ic" style={{ background: `var(--c-${item.color}-bg)`, color: `var(--c-${item.color})` }}><Icon /></span>
                  <span className="col flex1">
                    <span className="t-h3">{item.title}</span>
                    <span className="muted t-xs mt4">{item.text}</span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
