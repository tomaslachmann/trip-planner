'use client';

import { Banknote, Plus, Receipt, Utensils, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PlanScreen } from '../components/plan-screen';
import { useModal } from '../context/modal-context';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import { RoutePair } from './trip-route-shells';
import { TripRouteRuntime } from './trip-route-runtime';

function expenseIcon(type?: string) {
  if (type === 'food' || type === 'FOOD') return Utensils;
  if (type === 'stay' || type === 'ACCOMMODATION') return Banknote;
  return Receipt;
}

function DesktopCosts({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const { openModal } = useModal();
  const expenses = state.data.expenses;
  const members = state.selectedTrip?.members ?? [];
  const total = expenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
  const pp = members.length ? Math.round(total / members.length) : 0;

  return (
    <div className="desk-body">
      <div className="desk-scroll maxw">
        <div className="row between mb16">
          <h1 className="desk-h">Výdaje</h1>
          <Button type="button" onClick={() => openModal('addExpense')}><Plus size={16} />Přidat výdaj</Button>
        </div>

        {/* 3 stat cards */}
        <div className="grid3 mb16">
          {([
            ['Celkem utraceno', `${Math.round(total)} ${state.selectedTrip?.currency ?? 'EUR'}`, ''],
            ['Na osobu', `${pp} ${state.selectedTrip?.currency ?? 'EUR'}`, ''],
            ['K vyrovnání', `${Math.round(state.data.settlements.reduce((s, x) => s + x.amount, 0))} ${state.selectedTrip?.currency ?? 'EUR'}`, 'amber'],
          ] as [string, string, string][]).map(([label, val, tone]) => (
            <Card key={label} className="p-[16px] shadow-[var(--sh-sm)]">
              <span className="faint t-xs">{label}</span>
              <div className="t-title tnum mt4" style={{ fontSize: 28, color: tone === 'amber' ? 'var(--amber)' : 'var(--fg)' }}>{val}</div>
            </Card>
          ))}
        </div>

        {/* Expense list */}
        {expenses.length === 0 ? (
          <Card><EmptyState icon={<Wallet />} title="Zatím žádné výdaje." text="Přidej první výdaj pomocí tlačítka výše." /></Card>
        ) : (
          <Card className="shadow-[var(--sh-sm)]" style={{ padding: '4px 18px' }}>
            {expenses.map((e, i) => {
              const Icon = expenseIcon(e.currency);
                        return (
                <div key={e.id}>
                  {i > 0 && <hr className="sep" />}
                  <button
                    className="row pressable full"
                    style={{ padding: '14px 0', border: 0, background: 'transparent', textAlign: 'left', color: 'inherit' }}
                    type="button"
                    onClick={() => {
                      actions.setSelectedExpenseId(e.id);
                      openModal('addExpense', true);
                    }}
                  >
                    <div className="lead-ic"><Icon size={19} /></div>
                    <div className="col flex1" style={{ minWidth: 0 }}>
                      <span className="t-h3">{e.title}</span>
                      <span className="muted t-xs mt4 row g4">
                        split {e.splitType === 'EQUAL' ? 'rovný' : 'vlastní'}
                      </span>
                    </div>
                    <span className="badge muted" style={{ textTransform: 'capitalize' }}>výdaj</span>
                    <span className="t-h3 tnum" style={{ width: 80, textAlign: 'right' }}>{Number(e.amount).toFixed(0)} {e.currency}</span>
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

export function TripCostsRoute({ tripId }: { tripId: string }) {
  return (
    <TripRouteRuntime tripId={tripId} view="costs">
      {(planner) => (
        <RoutePair
          planner={planner}
          mobile={<PlanScreen planner={planner} forcedTab="costs" mobile />}
          desktop={<DesktopCosts planner={planner} />}
        />
      )}
    </TripRouteRuntime>
  );
}
