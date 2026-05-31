'use client';

import { ArrowRight, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '../components/avatar';
import { CostsPanel } from '../components/costs-panel';
import { SettlementPaymentContent } from '../components/settlement-payment';
import { TripBar } from '../components/trip-bar';
import { RoutePair } from './trip-route-shells';
import { TripRouteRuntime } from './trip-route-runtime';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import type { Settlement } from '../types';
import { cn } from '@/lib/utils';

function DesktopSettle({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const settlements = state.data.settlements;
  const members = state.selectedTrip?.members ?? [];
  const [selected, setSelected] = useState<Settlement | null>(settlements[0] ?? null);
  const currency = state.selectedTrip?.currency ?? 'EUR';
  const total = settlements.reduce((sum, s) => sum + s.amount, 0);

  useEffect(() => {
    if (!settlements.length) return setSelected(null);
    const matching = selected && settlements.find((item) => item.fromUserId === selected.fromUserId && item.toUserId === selected.toUserId);
    setSelected(matching || settlements[0]);
  }, [settlements, selected]);

  return (
    <div className="desk-body">
      {/* Left scrollable list */}
      <div className="desk-scroll" style={{ maxWidth: 680 }}>
        <div className="row between mb16">
          <h1 className="desk-h">Vyrovnání</h1>
          {total > 0 && <span className="badge amber tnum">{Math.round(total)} {currency} nevyrovnáno</span>}
        </div>

        {settlements.length === 0 ? (
          <Card><EmptyState icon={<Check />} title="Všechno je vyrovnané." text="Zatím není potřeba žádný převod." /></Card>
        ) : (
          settlements.map((s) => {
            const from = members.find((m) => m.userId === s.fromUserId);
            const to = members.find((m) => m.userId === s.toUserId);
            const isSelected = selected?.fromUserId === s.fromUserId && selected?.toUserId === s.toUserId;
            return (
              <Card
                key={`${s.fromUserId}-${s.toUserId}`}
                className={cn('p-[16px] shadow-[var(--sh-sm)] mb12 pressable', isSelected && 'outline outline-2 outline-[var(--primary)]')}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelected(s)}
              >
                <div className="row between">
                  <div className="row g8">
                    <Avatar name={from?.user.name ?? '?'} size="sm" />
                    <ArrowRight size={16} color="var(--faint-fg)" />
                    <Avatar name={to?.user.name ?? '?'} size="sm" />
                    <span className="t-sm" style={{ marginLeft: 4 }}>
                      <b>{from?.user.name ?? s.fromUserId.slice(0, 6)}</b>
                      {' → '}
                      <b>{to?.user.name ?? s.toUserId.slice(0, 6)}</b>
                    </span>
                  </div>
                  <span className="t-h2 tnum">{s.amount.toFixed(0)} {s.currency}</span>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Right panel: QR */}
      {selected && (
        <aside className="desk-panel">
          <div className="appbar"><span className="t-h3 flex1">QR platba</span></div>
          <SettlementPaymentContent settlement={selected} members={members} onStatusChange={(settlement, status) => void actions.updateSettlementStatus(settlement, status)} />
        </aside>
      )}
    </div>
  );
}

function MobileSettle({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  return (
    <div className="screen">
      <TripBar trip={state.selectedTrip} refreshing={state.loading} onRefresh={() => void actions.loadTrips()} />
      <CostsPanel
        trip={state.selectedTrip}
        expenses={state.data.expenses}
        settlements={state.data.settlements}
        onAddExpense={(data) => void actions.addExpense(data)}
        onUpdateSettlementStatus={(settlement, status) => void actions.updateSettlementStatus(settlement, status)}
        mobile
        initialMobileTab="settle"
      />
    </div>
  );
}

export function TripSettleRoute({ tripId }: { tripId: string }) {
  return (
    <TripRouteRuntime tripId={tripId} view="settle">
      {(planner) => (
        <RoutePair
          planner={planner}
          mobile={<MobileSettle planner={planner} />}
          desktop={<DesktopSettle planner={planner} />}
        />
      )}
    </TripRouteRuntime>
  );
}
