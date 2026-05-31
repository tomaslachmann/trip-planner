import { Banknote, Plus, Receipt, Send } from 'lucide-react';
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import type { Expense, Settlement, Trip } from '../types';

export function CostsPanel({
  trip,
  expenses,
  settlements,
  onAddExpense,
  mobile = false,
}: {
  trip?: Trip;
  expenses: Expense[];
  settlements: Settlement[];
  onAddExpense: (data: FormData) => void;
  mobile?: boolean;
}) {
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const members = trip?.members ?? [];
  const [formOpen, setFormOpen] = useState(!mobile);

  function ExpenseForm({ sheet = false }: { sheet?: boolean }) {
    return (
      <form
        className={sheet ? 'px18' : 'card pad sh mb16'}
        style={sheet ? { paddingBottom: 18 } : undefined}
        onSubmit={(event) => {
          event.preventDefault();
          onAddExpense(new FormData(event.currentTarget));
          event.currentTarget.reset();
          if (mobile) setFormOpen(false);
        }}
      >
        <div className="row between mb12">
          <span className="t-h3">Přidat náklad</span>
          <span className="badge"><Receipt />Rovný split</span>
        </div>
        <Label htmlFor={sheet ? 'expenseTitleSheet' : 'expenseTitle'}>Název</Label>
        <div className="input mb10"><Receipt /><input id={sheet ? 'expenseTitleSheet' : 'expenseTitle'} name="expenseTitle" placeholder="Večeře, půjčení auta..." /></div>
        <div className="row g8">
          <input className="input" name="amount" type="number" min="0" step="0.01" placeholder="Částka" aria-label="Částka" />
          <select className="input" name="splitScope" defaultValue="all" aria-label="Rozsah splitu">
            <option value="all">Všichni</option>
            <option value="selected">Vybraní</option>
          </select>
        </div>
        <div className="mt10">
          <span className="field-label">Vybraní účastníci</span>
          <div className="chips">
            {members.map((member) => (
              <label className="chip" key={member.userId}>
                <input name="splitUserIds" type="checkbox" value={member.userId} defaultChecked style={{ margin: 0 }} />
                {member.user.name}
              </label>
            ))}
          </div>
        </div>
        <button className="btn primary block mt12" type="submit"><Plus />Přidat náklad</button>
      </form>
    );
  }

  return (
    <div className="scroll px18 costs-view" style={{ flex: 1, paddingTop: 10, paddingBottom: mobile ? 92 : 18 }}>
      {mobile ? (
        <div className="card sh expense-summary">
          <div className="col flex1 center"><span className="t-h2 tnum">{Math.round(total)} {trip?.currency ?? 'EUR'}</span><span className="faint t-xs mt4">celkem</span></div>
          <div className="summary-sep" />
          <div className="col flex1 center"><span className="t-h2 tnum">{members.length ? Math.round(total / members.length) : 0} {trip?.currency ?? 'EUR'}</span><span className="faint t-xs mt4">na osobu</span></div>
          <div className="summary-sep" />
          <div className="col flex1 center"><span className="t-h2 tnum" style={{ color: 'var(--amber)' }}>{Math.round(settlements.reduce((sum, settlement) => sum + settlement.amount, 0))}</span><span className="faint t-xs mt4">nevyrovnáno</span></div>
        </div>
      ) : (
      <div className="grid2 mb16" style={{ gap: 10 }}>
        <div className="card pad sh">
          <span className="muted t-xs">Celkové náklady</span>
          <div className="t-title mt4">{Math.round(total)} {trip?.currency ?? 'EUR'}</div>
        </div>
        <div className="card pad sh">
          <span className="muted t-xs">Vyrovnání</span>
          <div className="t-title mt4">{settlements.length}</div>
        </div>
      </div>
      )}

      {!mobile && <ExpenseForm />}

      <div className="row between mb8">
        <span className="t-h2">Náklady</span>
        <span className="badge muted">{expenses.length}</span>
      </div>
      {expenses.map((expense, index) => (
        <div key={expense.id}>
          {index > 0 && <hr className="sep" />}
          <div className="listrow">
            <div className="lead-ic cat-food"><Banknote /></div>
            <div className="col flex1">
              <span className="t-h3">{expense.title}</span>
              <span className="muted t-xs mt4">{expense.splitType === 'EQUAL' ? 'rovný' : 'vlastní'} split</span>
            </div>
            <span className="t-h3 tnum">{Number(expense.amount).toFixed(0)} {expense.currency}</span>
          </div>
        </div>
      ))}

      <div className="row between mt20 mb8">
        <span className="t-h2">Vyrovnání</span>
        <span className="badge green"><Send />Připraveno</span>
      </div>
      {settlements.length === 0 && <div className="card pad muted center t-sm">Zatím není potřeba žádný převod.</div>}
      {settlements.map((settlement, index) => (
        <div className="card pad sh mb8" key={`${settlement.fromUserId}-${settlement.toUserId}-${index}`}>
          <div className="row between">
            <div className="col">
              <span className="t-h3">Převod</span>
              <span className="muted t-xs mt4">{settlement.fromUserId.slice(0, 8)} → {settlement.toUserId.slice(0, 8)}</span>
            </div>
            <span className="t-h3 tnum">{settlement.amount.toFixed(2)} {settlement.currency}</span>
          </div>
        </div>
      ))}
      {mobile && (
        <>
          <button className="fab expense-add-fab" type="button" onClick={() => setFormOpen(true)} aria-label="Přidat náklad"><Plus /></button>
          {formOpen && (
            <Sheet open onOpenChange={(open) => !open && setFormOpen(false)}>
              <SheetContent style={{ height: 'auto' }}>
                <div className="grabber" />
                <div className="sheet-head">
                  <SheetTitle className="t-h3">Nový náklad</SheetTitle>
                  <button className="btn ghost sm" type="button" onClick={() => setFormOpen(false)}>Zavřít</button>
                </div>
                <ExpenseForm sheet />
              </SheetContent>
            </Sheet>
          )}
        </>
      )}
    </div>
  );
}
