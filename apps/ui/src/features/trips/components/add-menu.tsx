import { BedDouble, ChevronRight, MapPin, MessageSquare, Receipt, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
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
  presentation = 'sheet',
}: {
  onClose: () => void;
  onPick: (target: PickTarget) => void;
  presentation?: 'sheet' | 'dialog';
}) {
  const content = (
    <>
      {presentation === 'sheet' && <div className="grabber" />}
      <div className={presentation === 'dialog' ? 'trip-dialog-head' : 'sheet-head'}>
        {presentation === 'dialog' ? <DialogTitle className="t-h3">Přidat do výletu</DialogTitle> : <SheetTitle className="t-h3">Přidat do výletu</SheetTitle>}
        {presentation === 'sheet' && <Button size="icon" variant="ghost" type="button" onClick={onClose}><X /></Button>}
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
    </>
  );

  if (presentation === 'dialog') {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="trip-dialog-content flex max-h-[calc(100vh-48px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[460px]">
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent style={{ height: 'auto' }}>
        {content}
      </SheetContent>
    </Sheet>
  );
}
