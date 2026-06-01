'use client';

import { ArrowRight, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { Avatar } from '@/features/trips/components/avatar';
import { CostsPanel } from '@/features/trips/components/costs-panel';
import { SettlementPaymentContent, settlementReceiptExpenses } from '@/features/trips/components/settlement-payment';
import { TripBar } from '@/features/trips/components/trip-bar';
import { useTripPlannerContext, useTripViewport } from '@/features/trips/context/trip-planner-context';
import type { TripPlannerController } from '@/features/trips/hooks/use-trip-planner';
import type { Settlement } from '@/features/trips/types';

function DesktopSettlePage({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const settlements = state.data.settlements;
  const expenses = state.data.expenses;
  const members = state.selectedTrip?.members ?? [];
  const [selected, setSelected] = useState<Settlement | null>(settlements[0] ?? null);
  const currency = state.selectedTrip?.currency ?? 'EUR';
  const total = settlements.reduce((sum, settlement) => sum + settlement.amount, 0);

  useEffect(() => {
    if (!settlements.length) return setSelected(null);
    const matching = selected && settlements.find((item) => item.fromUserId === selected.fromUserId && item.toUserId === selected.toUserId);
    setSelected(matching || settlements[0]);
  }, [settlements, selected]);

  return (
    <div className="desk-body">
      <div className="desk-scroll">
        <div className="row between mb16">
          <h1 className="desk-h">Vyrovnání</h1>
          {total > 0 && <span className="badge amber tnum">{Math.round(total)} {currency} nevyrovnáno</span>}
        </div>

        {settlements.length === 0 ? (
          <Card><EmptyState icon={<Check />} title="Všechno je vyrovnané." text="Zatím není potřeba žádný převod." /></Card>
        ) : (
          settlements.map((settlement) => {
            const from = members.find((member) => member.userId === settlement.fromUserId);
            const to = members.find((member) => member.userId === settlement.toUserId);
            const isSelected = selected?.fromUserId === settlement.fromUserId && selected?.toUserId === settlement.toUserId;
            const receiptCount = settlementReceiptExpenses(settlement, expenses).length;
            return (
              <Card
                key={`${settlement.fromUserId}-${settlement.toUserId}`}
                className={cn('p-[16px] shadow-[var(--sh-sm)] mb12 pressable', isSelected && 'outline outline-2 outline-[var(--primary)]')}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelected(settlement)}
              >
                <div className="row between">
                  <div className="row g8">
                    <Avatar name={from?.user.name ?? '?'} size="sm" />
                    <ArrowRight size={16} color="var(--faint-fg)" />
                    <Avatar name={to?.user.name ?? '?'} size="sm" />
                    <span className="t-sm" style={{ marginLeft: 4 }}>
                      <b>{from?.user.name ?? settlement.fromUserId.slice(0, 6)}</b>
                      {' -> '}
                      <b>{to?.user.name ?? settlement.toUserId.slice(0, 6)}</b>
                    </span>
                  </div>
                  <div className="col" style={{ alignItems: 'flex-end' }}>
                    <span className="t-h2 tnum">{settlement.amount.toFixed(0)} {settlement.currency}</span>
                    {receiptCount > 0 && <span className="badge muted mt4">{receiptCount} účtenek</span>}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {selected && (
        <aside className="desk-panel">
          <div className="appbar"><span className="t-h3 flex1">QR platba</span></div>
          <SettlementPaymentContent settlement={selected} members={members} expenses={expenses} onStatusChange={(settlement, status) => void actions.updateSettlementStatus(settlement, status)} />
        </aside>
      )}
    </div>
  );
}

function MobileSettlePage({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  return (
    <div className="screen">
      <TripBar trip={state.selectedTrip} />
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

export default function TripSettlePage() {
  const planner = useTripPlannerContext();
  const { isDesktop } = useTripViewport();
  return isDesktop ? <DesktopSettlePage planner={planner} /> : <MobileSettlePage planner={planner} />;
}
