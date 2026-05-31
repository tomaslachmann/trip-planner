import { BedDouble, ChevronRight, MapPin, MessageSquare, Receipt, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

const items = [
  {
    key: 'place' as const,
    title: 'Přidat místo',
    text: 'Vyhledej místo nebo přidej pin do mapy',
    icon: MapPin,
    color: 'see',
  },
  {
    key: 'stay' as const,
    title: 'Přidat ubytování',
    text: 'Vlož odkaz z Booking.com nebo Airbnb',
    icon: BedDouble,
    color: 'stay',
  },
  {
    key: 'expense' as const,
    title: 'Přidat výdaj',
    text: 'Zapiš sdílený náklad a rozděl ho',
    icon: Receipt,
    color: 'food',
  },
  {
    key: 'note' as const,
    title: 'Komentář / poznámka',
    text: 'Nech poznámku pro skupinu',
    icon: MessageSquare,
    color: 'act',
  },
] as const;

type PickTarget = 'place' | 'stay' | 'expense' | 'note';

export function AddMenu({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (target: PickTarget) => void;
}) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent style={{ height: 'auto' }}>
        <div className="grabber" />
        <div className="sheet-head">
          <SheetTitle className="t-h3">Přidat do tripu</SheetTitle>
          <Button size="icon" variant="ghost" type="button" onClick={onClose}><X /></Button>
        </div>
        <div className="px18" style={{ paddingBottom: 22 }}>
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.key}>
                {index > 0 && <hr className="sep" />}
                <div
                  className="row pressable"
                  style={{ padding: '13px 0', cursor: 'pointer' }}
                  onClick={() => {
                    onPick(item.key as PickTarget);
                  }}
                >
                  <div
                    className="lead-ic"
                    style={{
                      background: `var(--c-${item.color}-bg)`,
                      color: `var(--c-${item.color})`,
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="col flex1">
                    <span className="t-h3">{item.title}</span>
                    <span className="muted t-xs mt4">{item.text}</span>
                  </div>
                  <ChevronRight size={18} color="var(--faint-fg)" />
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
