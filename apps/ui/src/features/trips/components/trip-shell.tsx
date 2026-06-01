'use client';

import { ArrowLeftRight, BedDouble, LayoutGrid, ListChecks, Landmark, Map, Plus, Route, Settings, UserPlus, Users, Vote, Wallet } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, type ElementType, type ReactNode } from 'react';
import { Avatar } from './avatar';
import { BottomNav } from './bottom-nav';
import { AddMenu } from './add-menu';
import { CommandPalette } from './command-palette';
import { AddExpenseSheet, AddPlaceSheet, AddAccommodationSheet, AddItinerarySheet, AddNoteSheet, TripSettingsSheet, CreatePollDialog } from './dialogs';
import { ModalProvider, useModal } from '../context/modal-context';
import { formatTripRange } from '../lib/format';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import type { TabKey } from '../types';
import { cn } from '@/lib/utils';

type NavItem = { key: string; label: string; icon: ElementType; href: (tripId: string) => string; pathMatch: string };
const desktopNav: NavItem[] = [
  { key: 'map',       label: 'Mapa',        icon: Map,            href: (id) => `/trips/${id}/map`,       pathMatch: '/map' },
  { key: 'places',    label: 'Místa',       icon: Landmark,       href: (id) => `/trips/${id}/places`,    pathMatch: '/places' },
  { key: 'itin',      label: 'Itinerář',    icon: Route,          href: (id) => `/trips/${id}/itinerary`, pathMatch: '/itinerary' },
  { key: 'stay',      label: 'Ubytování',   icon: BedDouble,      href: (id) => `/trips/${id}/stay`,      pathMatch: '/stay' },
  { key: 'costs',     label: 'Výdaje',      icon: Wallet,         href: (id) => `/trips/${id}/costs`,     pathMatch: '/costs' },
  { key: 'settle',    label: 'Vyrovnání',   icon: ArrowLeftRight, href: (id) => `/trips/${id}/settle`,    pathMatch: '/settle' },
  { key: 'members',   label: 'Členové',     icon: Users,          href: (id) => `/trips/${id}/members`,   pathMatch: '/members' },
  { key: 'checklist', label: 'Seznam úkolů', icon: ListChecks,    href: (id) => `/trips/${id}/checklist`, pathMatch: '/checklist' },
  { key: 'polls',     label: 'Hlasování',   icon: Vote,           href: (id) => `/trips/${id}/polls`,     pathMatch: '/polls' },
  { key: 'more',      label: 'Přehled',     icon: LayoutGrid,     href: (id) => `/trips/${id}/more`,      pathMatch: '/more' },
];

function MobileShellInner({ planner, children }: { planner: TripPlannerController; children: ReactNode }) {
  const { state, actions } = planner;
  const [addOpen, setAddOpen] = useState(false);
  const { modal, openModal, closeModal } = useModal();
  const active = state.activeTab === 'settle'
    ? 'costs'
    : state.activeTab === 'stay' || state.activeTab === 'itinerary' || state.activeTab === 'places'
      ? 'plan'
      : state.activeTab;
  const showBottomNav = ['map', 'plan', 'places', 'stay', 'itinerary', 'costs', 'settle', 'more'].includes(state.activeTab);

  function pickAdd(target: 'place' | 'stay' | 'expense' | 'note') {
    setAddOpen(false);
    if (target === 'place') openModal('addPlace');
    if (target === 'stay') openModal('addStay');
    if (target === 'expense') openModal('addExpense');
    if (target === 'note') openModal('addNote');
  }

  return (
    <div className="mobile-stage">
      <div className="mobile-app-shell">
        <div className="viewport">{children}</div>
        {showBottomNav && <BottomNav active={active as TabKey} tripHref={actions.tripHref} onNav={actions.setActiveTab} onAdd={() => setAddOpen(true)} />}
        {state.message && <div className="badge red" style={{ position: 'absolute', left: 18, right: 18, bottom: showBottomNav ? 88 : 18, zIndex: 70, justifyContent: 'center' }}>{state.message}</div>}
        <CommandPalette planner={planner} />
        {addOpen && <AddMenu onClose={() => setAddOpen(false)} onPick={pickAdd} />}
        {modal.type === 'addExpense'  && <AddExpenseSheet     planner={planner} edit={modal.edit} onClose={closeModal} />}
        {modal.type === 'addPlace'    && <AddPlaceSheet       planner={planner} edit={modal.edit} onClose={closeModal} />}
        {modal.type === 'addStay'     && <AddAccommodationSheet planner={planner} edit={modal.edit} onClose={closeModal} />}
        {modal.type === 'addItinerary'&& <AddItinerarySheet   planner={planner} initialDayId={modal.dayId} onClose={closeModal} />}
        {modal.type === 'addNote'     && <AddNoteSheet        planner={planner} onClose={closeModal} />}
        {modal.type === 'createPoll'  && <CreatePollDialog    planner={planner} onClose={closeModal} />}
        {modal.type === 'tripSettings'&& <TripSettingsSheet   planner={planner} onClose={closeModal} />}
      </div>
    </div>
  );
}

export function MobileRouteShell({ planner, children }: { planner: TripPlannerController; children: ReactNode }) {
  return (
    <ModalProvider>
      <MobileShellInner planner={planner}>{children}</MobileShellInner>
    </ModalProvider>
  );
}

function DesktopShellInner({ planner, children }: { planner: TripPlannerController; children: ReactNode }) {
  const { state, actions } = planner;
  const [addOpen, setAddOpen] = useState(false);
  const tripId = state.selectedTripId;
  const pathname = usePathname();
  const { modal, openModal, closeModal } = useModal();

  const totalSettlements = state.data.settlements.reduce((sum, s) => sum + s.amount, 0);

  function pickAdd(target: 'place' | 'stay' | 'expense' | 'note') {
    setAddOpen(false);
    if (target === 'place') openModal('addPlace');
    if (target === 'stay') openModal('addStay');
    if (target === 'expense') openModal('addExpense');
    if (target === 'note') openModal('addNote');
  }

  return (
    <div className="desktop-stage">
      <div className="desk">
        {/* Sidebar */}
        <aside className="desk-side">
          <div className="desk-brand">
            <div className="logo"><Map size={18} /></div>
            <b style={{ fontSize: 16, letterSpacing: '-.01em' }}>Trip Planner</b>
          </div>

          {/* Trip switcher */}
          <div className="desk-tripsw">
            <div className="lead-ic" style={{ width: 30, height: 30, borderRadius: 8 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/>
              </svg>
            </div>
            <div className="col flex1" style={{ minWidth: 0 }}>
              <span className="t-sm semib" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{state.selectedTrip?.name ?? 'Žádný výlet'}</span>
              <span className="faint t-xs">{formatTripRange(state.selectedTrip)}</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--faint-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
          </div>

          {/* Nav */}
          <nav className="desk-nav">
            {desktopNav.map((item) => {
              const Icon = item.icon;
              const href = tripId ? item.href(tripId) : '#';
              const isActive = pathname.endsWith(item.pathMatch);
              return (
                <Link
                  key={item.key + item.label}
                  className={cn('desk-lnk', isActive && 'on')}
                  href={href}
                  scroll={false}
                >
                  <Icon size={14} />{item.label}
                </Link>
              );
            })}
          </nav>

          <div className="spacer" />

          {/* User */}
          <Link className="desk-user" href={tripId ? `/trips/${tripId}/settings` : '/trips'} scroll={false} style={{ color: 'inherit', textDecoration: 'none' }}>
            <Avatar name={state.actorMember?.user.name ?? 'Ty'} />
            <div className="col flex1" style={{ minWidth: 0 }}>
              <span className="t-sm semib">{state.actorMember?.user.name ?? 'Ty'}</span>
              <span className="faint t-xs" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{state.viewerEmail}</span>
            </div>
            <Settings size={18} color="var(--faint-fg)" />
          </Link>
        </aside>

        {/* Main */}
        <main className="desk-main">
          {/* Top bar matching design */}
          <div className="desk-top">
            <div className="col flex1" style={{ minWidth: 0 }}>
              <div className="row g8">
                <b style={{ fontSize: 16 }}>{state.selectedTrip?.name ?? 'Trip Planner'}</b>
                <span className="badge muted">Aktivní</span>
              </div>
              <span className="faint t-xs mt4 row g6">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                {state.selectedTrip?.destination ?? '—'}
                <span className="dotsep" />
                {formatTripRange(state.selectedTrip)}
              </span>
            </div>
            {totalSettlements > 0 && (
              <span className="badge amber tnum">€{Math.round(totalSettlements)} k vyrovnání</span>
            )}
            {(state.selectedTrip?.members ?? []).length > 0 && (
              <div className="av-row">
                {(state.selectedTrip?.members ?? []).slice(0, 4).map((m) => (
                  <Avatar key={m.userId} name={m.user.name} size="sm" />
                ))}
              </div>
            )}
            {state.message && <div className="badge red" style={{ justifyContent: 'center' }}>{state.message}</div>}
            <CommandPalette planner={planner} showTrigger />
            <button className="btn outline sm" type="button" onClick={() => actions.setActiveTab('members')}>
              <UserPlus size={15} />Pozvat
            </button>
            <button className="btn primary sm" type="button" onClick={() => setAddOpen(true)}>
              <Plus size={15} />Přidat
            </button>
          </div>

          {children}
        </main>

        {/* Add menu modal */}
        {addOpen && <AddMenu onClose={() => setAddOpen(false)} onPick={pickAdd} />}

        {/* Dialog forms */}
        {modal.type === 'addExpense'  && <AddExpenseSheet     planner={planner} edit={modal.edit} onClose={closeModal} />}
        {modal.type === 'addPlace'    && <AddPlaceSheet       planner={planner} edit={modal.edit} onClose={closeModal} />}
        {modal.type === 'addStay'     && <AddAccommodationSheet planner={planner} edit={modal.edit} onClose={closeModal} />}
        {modal.type === 'addItinerary'&& <AddItinerarySheet   planner={planner} initialDayId={modal.dayId} onClose={closeModal} />}
        {modal.type === 'addNote'     && <AddNoteSheet        planner={planner} onClose={closeModal} />}
        {modal.type === 'createPoll'  && <CreatePollDialog    planner={planner} onClose={closeModal} />}
        {modal.type === 'tripSettings'&& <TripSettingsSheet   planner={planner} onClose={closeModal} />}
      </div>
    </div>
  );
}

export function DesktopRouteShell({ planner, children }: { planner: TripPlannerController; children: ReactNode }) {
  return (
    <ModalProvider>
      <DesktopShellInner planner={planner}>{children}</DesktopShellInner>
    </ModalProvider>
  );
}
