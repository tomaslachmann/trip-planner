'use client';

import { useEffect, useMemo, useState, type ElementType } from 'react';
import { ArrowLeftRight, BedDouble, CheckSquare, Landmark, LayoutGrid, ListChecks, Map, Plus, Route, Search, Settings, StickyNote, Users, Vote, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import type { TabKey } from '../types';
import { useModal } from '../context/modal-context';

type PaletteItem = {
  label: string;
  hint: string;
  icon: ElementType;
  run: () => void;
};

const navigationItems: Array<{ label: string; hint: string; icon: ElementType; tab: TabKey | 'places' }> = [
  { label: 'Mapa', hint: 'Otevřít mapu', icon: Map, tab: 'map' },
  { label: 'Místa', hint: 'Seznam míst a návrhů', icon: Landmark, tab: 'places' },
  { label: 'Itinerář', hint: 'Denní plán', icon: Route, tab: 'itinerary' },
  { label: 'Ubytování', hint: 'Nabídky a vybrané pobyty', icon: BedDouble, tab: 'stay' },
  { label: 'Výdaje', hint: 'Náklady výletu', icon: Wallet, tab: 'costs' },
  { label: 'Vyrovnání', hint: 'Platby mezi lidmi', icon: ArrowLeftRight, tab: 'settle' },
  { label: 'Členové', hint: 'Účastníci a role', icon: Users, tab: 'members' },
  { label: 'Seznam úkolů', hint: 'Úkoly před cestou', icon: ListChecks, tab: 'checklist' },
  { label: 'Hlasování', hint: 'Ankety skupiny', icon: Vote, tab: 'polls' },
  { label: 'Přehled', hint: 'Poznámky, aktivita a nastavení', icon: LayoutGrid, tab: 'more' },
];

export function CommandPalette({ planner, showTrigger = false }: { planner: TripPlannerController; showTrigger?: boolean }) {
  const [open, setOpen] = useState(false);
  const { state, actions } = planner;
  const { openModal } = useModal();
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function runAndClose(run: () => void) {
    run();
    setOpen(false);
  }

  function goTo(tab: TabKey | 'places') {
    const tripId = state.selectedTripId;
    if (!tripId) return;

    if (tab === 'places') {
      router.push(`/trips/${encodeURIComponent(tripId)}/places`, { scroll: false });
      return;
    }

    actions.setActiveTab(tab);
  }

  const createItems = useMemo<PaletteItem[]>(() => [
    { label: 'Přidat místo', hint: 'Nový návrh na mapu', icon: Plus, run: () => openModal('addPlace') },
    { label: 'Přidat ubytování', hint: 'Uložit pobyt', icon: BedDouble, run: () => openModal('addStay') },
    { label: 'Přidat výdaj', hint: 'Rozdělit náklad', icon: Wallet, run: () => openModal('addExpense') },
    { label: 'Přidat poznámku', hint: 'Poznámka do přehledu', icon: StickyNote, run: () => openModal('addNote') },
    { label: 'Nová anketa', hint: 'Hlasování skupiny', icon: Vote, run: () => openModal('createPoll') },
    { label: 'Nastavení výletu', hint: 'Termín, destinace a pravidla', icon: Settings, run: () => openModal('tripSettings') },
  ], [openModal]);

  return (
    <>
      {showTrigger && (
        <Button variant="outline" size="sm" type="button" onClick={() => setOpen(true)}>
          <Search size={15} />
          Akce
          <span className="faint t-xs">⌘K</span>
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-[560px]">
          <DialogTitle className="sr-only">Rychlé akce</DialogTitle>
          <Command>
            <CommandInput placeholder="Najít stránku nebo akci..." />
            <CommandList>
              <CommandEmpty>Nic nenalezeno.</CommandEmpty>
              <CommandGroup heading="Navigace">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem key={item.label} value={`${item.label} ${item.hint}`} onSelect={() => runAndClose(() => goTo(item.tab))}>
                      <Icon className="size-4" />
                      <span className="flex1">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.hint}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandGroup heading="Vytvořit">
                {createItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem key={item.label} value={`${item.label} ${item.hint}`} onSelect={() => runAndClose(item.run)}>
                      <Icon className="size-4" />
                      <span className="flex1">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.hint}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandGroup heading="Plánování">
                <CommandItem value="Seznam úkolů dokončení před cestou" onSelect={() => runAndClose(() => goTo('checklist'))}>
                  <CheckSquare className="size-4" />
                  <span className="flex1">Zkontrolovat přípravu</span>
                  <span className="text-xs text-muted-foreground">Seznam úkolů</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
