'use client';

import { Banknote, Plus, Receipt, Utensils, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { CostsPanel } from '@/features/trips/components/costs-panel';
import { TripBar } from '@/features/trips/components/trip-bar';
import { useModal } from '@/features/trips/context/modal-context';
import { useTripPlannerContext, useTripViewport } from '@/features/trips/context/trip-planner-context';
import type { TripPlannerController } from '@/features/trips/hooks/use-trip-planner';

function expenseIcon(type?: string) {
  if (type === 'food' || type === 'FOOD') return Utensils;
  if (type === 'stay' || type === 'ACCOMMODATION') return Banknote;
  return Receipt;
}

function DesktopCostsPage({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const { openModal } = useModal();
  const expenses = state.data.expenses;
  const members = state.selectedTrip?.members ?? [];
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const perPerson = members.length ? Math.round(total / members.length) : 0;

  return (
    <div className="desk-body">
      <div className="desk-scroll maxw">
        <div className="row between mb16">
          <h1 className="desk-h">Výdaje</h1>
          <Button type="button" onClick={() => openModal('addExpense')}><Plus size={16} />Přidat výdaj</Button>
        </div>

        <div className="grid3 mb16">
          {([
            ['Celkem utraceno', `${Math.round(total)} ${state.selectedTrip?.currency ?? 'EUR'}`, ''],
            ['Na osobu', `${perPerson} ${state.selectedTrip?.currency ?? 'EUR'}`, ''],
            ['K vyrovnání', `${Math.round(state.data.settlements.reduce((sum, settlement) => sum + settlement.amount, 0))} ${state.selectedTrip?.currency ?? 'EUR'}`, 'amber'],
          ] as [string, string, string][]).map(([label, value, tone]) => (
            <Card key={label} className="p-[16px] shadow-[var(--sh-sm)]">
              <span className="faint t-xs">{label}</span>
              <div className="t-title tnum mt4" style={{ fontSize: 28, color: tone === 'amber' ? 'var(--amber)' : 'var(--fg)' }}>{value}</div>
            </Card>
          ))}
        </div>

        {expenses.length === 0 ? (
          <Card><EmptyState icon={<Wallet />} title="Zatím žádné výdaje." text="Přidej první výdaj pomocí tlačítka výše." /></Card>
        ) : (
          <Card className="shadow-[var(--sh-sm)]" style={{ padding: '4px 18px' }}>
            {expenses.map((expense, index) => {
              const Icon = expenseIcon(expense.category ?? undefined);
              return (
                <div key={expense.id}>
                  {index > 0 && <hr className="sep" />}
                  <button
                    className="row pressable full"
                    style={{ padding: '14px 0', border: 0, background: 'transparent', textAlign: 'left', color: 'inherit' }}
                    type="button"
                    onClick={() => {
                      actions.setSelectedExpenseId(expense.id);
                      openModal('addExpense', true);
                    }}
                  >
                    <div className="lead-ic"><Icon size={19} /></div>
                    <div className="col flex1" style={{ minWidth: 0 }}>
                      <span className="t-h3">{expense.title}</span>
                      <span className="muted t-xs mt4 row g4">split {expense.splitType === 'EQUAL' ? 'rovný' : 'vlastní'}</span>
                    </div>
                    <span className="badge muted">{expense.category ?? 'OTHER'}</span>
                    <span className="t-h3 tnum" style={{ width: 80, textAlign: 'right' }}>{Number(expense.amount).toFixed(0)} {expense.currency}</span>
                  </button>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}

function MobileCostsPage({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const { openModal } = useModal();
  return (
    <div className="screen">
      <TripBar trip={state.selectedTrip} />
      <CostsPanel
        trip={state.selectedTrip}
        expenses={state.data.expenses}
        settlements={state.data.settlements}
        onAddExpense={(data) => void actions.addExpense(data)}
        onEditExpense={(expenseId) => {
          actions.setSelectedExpenseId(expenseId);
          openModal('addExpense', true);
        }}
        onUpdateSettlementStatus={(settlement, status) => void actions.updateSettlementStatus(settlement, status)}
        mobile
      />
    </div>
  );
}

export default function TripCostsPage() {
  const planner = useTripPlannerContext();
  const { isDesktop } = useTripViewport();
  return isDesktop ? <DesktopCostsPage planner={planner} /> : <MobileCostsPage planner={planner} />;
}
