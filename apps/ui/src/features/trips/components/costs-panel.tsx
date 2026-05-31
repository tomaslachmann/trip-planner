import { AlertTriangle, Banknote, BedDouble, Bus, Check, CircleEllipsis, ForkKnife, Landmark, Plus, QrCode, Receipt, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipButton } from '@/components/ui/chip-group';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { StatsCard } from '@/components/ui/stats-card';
import { SettlementParticipants, SettlementPaymentSheet } from './settlement-payment';
import type { Expense, Settlement, Trip } from '../types';

const expenseCategories = [
  { value: 'FOOD', label: 'Jídlo' },
  { value: 'STAY', label: 'Ubytování' },
  { value: 'TRANSPORT', label: 'Doprava' },
  { value: 'ACTIVITY', label: 'Aktivita' },
  { value: 'OTHER', label: 'Ostatní' },
];

function expenseIcon(category?: string | null) {
  if (category === 'FOOD') return ForkKnife;
  if (category === 'STAY') return BedDouble;
  if (category === 'TRANSPORT') return Bus;
  if (category === 'ACTIVITY') return Landmark;
  if (category === 'OTHER') return CircleEllipsis;
  return Banknote;
}

function ExpenseFields({ idPrefix, members }: { idPrefix: string; members: Trip['members'] }) {
  const [splitScope, setSplitScope] = useState<'all' | 'selected'>('all');
  const [category, setCategory] = useState('OTHER');
  const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries((members ?? []).map((member) => [member.userId, true])));

  return (
    <>
      <input type="hidden" name="splitScope" value={splitScope} />
      <input type="hidden" name="category" value={category} />
      <div className="row between mb12">
        <span className="t-h3">Přidat náklad</span>
        <span className="badge"><Receipt />Rovný split</span>
      </div>
      <Label htmlFor={`${idPrefix}-title`}>Název</Label>
      <div className="relative mb10">
        <Receipt className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" id={`${idPrefix}-title`} name="expenseTitle" placeholder="Večeře, půjčení auta..." />
      </div>
      <div className="row g8">
        <Input name="amount" type="number" min="0" step="0.01" placeholder="Částka" aria-label="Částka" />
        <Select value={splitScope} onValueChange={(value) => setSplitScope(value as 'all' | 'selected')}>
          <SelectTrigger aria-label="Rozsah splitu"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všichni</SelectItem>
            <SelectItem value="selected">Vybraní</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="row g8 mt8">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger aria-label="Kategorie"><SelectValue /></SelectTrigger>
          <SelectContent>
            {expenseCategories.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input name="spentAtDate" type="date" aria-label="Datum výdaje" />
      </div>
      <Input className="mt8" name="receiptUrl" type="url" placeholder="Odkaz na účtenku" aria-label="Odkaz na účtenku" />
      <div className="row g8 mt8">
        <Input name="originalAmount" type="number" min="0" step="0.01" placeholder="Původní částka" aria-label="Původní částka" />
        <Input name="originalCurrency" placeholder="Původní měna" aria-label="Původní měna" />
        <Input name="exchangeRate" type="number" min="0" step="0.0001" placeholder="Kurz" aria-label="Kurz" />
      </div>
      <div className="mt10">
        <span className="field-label">Vybraní účastníci</span>
        <div className="chips">
          {(members ?? []).map((member) => (
            <ChipButton
              key={member.userId}
              selected={splitScope === 'all' || !!selected[member.userId]}
              disabled={splitScope === 'all'}
              onClick={() => setSelected((current) => ({ ...current, [member.userId]: !current[member.userId] }))}
            >
              {(splitScope === 'all' || !!selected[member.userId]) && <Check size={14} />}
              {splitScope === 'selected' && selected[member.userId] && <input type="hidden" name="splitUserIds" value={member.userId} />}
              {member.user.name}
            </ChipButton>
          ))}
        </div>
      </div>
      <Button className="mt12 w-full" type="submit"><Plus />Přidat náklad</Button>
    </>
  );
}

export function CostsPanel({
  trip,
  expenses,
  settlements,
  onAddExpense,
  onEditExpense,
  onOpenSettlement,
  onUpdateSettlementStatus,
  mobile = false,
  initialMobileTab = 'expenses',
}: {
  trip?: Trip;
  expenses: Expense[];
  settlements: Settlement[];
  onAddExpense: (data: FormData) => void;
  onEditExpense?: (expenseId: string) => void;
  onOpenSettlement?: (settlement: Settlement) => void;
  onUpdateSettlementStatus?: (settlement: Settlement, status: 'OPEN' | 'PAID' | 'CONFIRMED' | 'CANCELLED') => void;
  mobile?: boolean;
  initialMobileTab?: 'expenses' | 'settle';
}) {
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const members = trip?.members ?? [];
  const [formOpen, setFormOpen] = useState(!mobile);
  const [mobileTab, setMobileTab] = useState<'expenses' | 'settle'>(initialMobileTab);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);

  useEffect(() => {
    setMobileTab(initialMobileTab);
  }, [initialMobileTab]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddExpense(new FormData(event.currentTarget));
    event.currentTarget.reset();
    if (mobile) setFormOpen(false);
  }

  return (
    <div className="scroll px18 costs-view" style={{ flex: 1, paddingTop: 10, paddingBottom: mobile ? 92 : 18 }}>
      {mobile && (
        <SegmentedControl
          className="mb12"
          value={mobileTab}
          onValueChange={setMobileTab}
          options={[
            { value: 'expenses', label: 'Výdaje' },
            { value: 'settle', label: 'Vyrovnání' },
          ]}
        />
      )}

      {mobile ? (
        mobileTab === 'expenses' ? (
          <StatsCard
            className="expense-summary"
            items={[
              { value: `${Math.round(total)} ${trip?.currency ?? 'EUR'}`, label: 'celkem' },
              { value: `${members.length ? Math.round(total / members.length) : 0} ${trip?.currency ?? 'EUR'}`, label: 'na osobu' },
              { value: Math.round(settlements.reduce((sum, s) => sum + s.amount, 0)), label: 'nevyrovnáno', tone: 'amber' },
            ]}
          />
        ) : (
          <Card className="p-[14px] shadow-[var(--sh-sm)] mb12" style={{ background: 'var(--subtle)' }}>
            <div className="row between">
              <div className="row g10">
                <div className="lead-ic" style={{ background: '#fffbeb', color: 'var(--amber)' }}><Send /></div>
                <div className="col">
                  <span className="t-h3">{settlements.length} převodů k vyrovnání</span>
                  <span className="muted t-xs mt4">Minimalizované platby mezi členy</span>
                </div>
              </div>
              <span className="badge amber tnum">{Math.round(settlements.reduce((sum, s) => sum + s.amount, 0))} {trip?.currency ?? 'EUR'}</span>
            </div>
          </Card>
        )
      ) : (
        <div className="grid2 mb16" style={{ gap: 10 }}>
          <Card className="p-[14px] shadow-[var(--sh-sm)]">
            <span className="muted t-xs">Celkové náklady</span>
            <div className="t-title mt4">{Math.round(total)} {trip?.currency ?? 'EUR'}</div>
          </Card>
          <Card className="p-[14px] shadow-[var(--sh-sm)]">
            <span className="muted t-xs">Vyrovnání</span>
            <div className="t-title mt4">{settlements.length}</div>
          </Card>
        </div>
      )}

      {!mobile && (
        <Card className="p-[14px] shadow-[var(--sh-sm)] mb16">
          <form onSubmit={handleSubmit}>
            <ExpenseFields idPrefix="desktop" members={members} />
          </form>
        </Card>
      )}

      {(!mobile || mobileTab === 'expenses') && (
        <>
          <div className="row between mb8">
            <span className="t-h2">Výdaje</span>
            <span className="badge muted">{expenses.length}</span>
          </div>
          {expenses.map((expense, index) => {
	        const Icon = expenseIcon(expense.category);
	        const rowContent = (
	          <>
	            <div className="lead-ic cat-food"><Icon /></div>
	            <div className="col flex1">
	              <span className="t-h3">{expense.title}</span>
	              <span className="muted t-xs mt4">
	                {expense.category ?? 'OTHER'} · {expense.splitType === 'EQUAL' ? 'rovný' : 'vlastní'} split
	                {expense.spentAt ? ` · ${new Date(expense.spentAt).toLocaleDateString('cs-CZ')}` : ''}
	                {expense.receiptUrl ? ' · účtenka' : ''}
	              </span>
	            </div>
            <span className="t-h3 tnum">{Number(expense.amount).toFixed(0)} {expense.currency}</span>
          </>
        );
        return (
          <div key={expense.id}>
            {index > 0 && <hr className="sep" />}
            {onEditExpense ? (
              <button
                className="listrow full pressable"
                style={{ border: 0, background: 'transparent', color: 'inherit', textAlign: 'left' }}
                type="button"
                onClick={() => onEditExpense(expense.id)}
              >
                {rowContent}
              </button>
            ) : (
              <div className="listrow">{rowContent}</div>
            )}
          </div>
        );
      })}
        </>
      )}

      {(!mobile || mobileTab === 'settle') && (
        <>
          <div className={`row between ${mobile ? 'mb8' : 'mt20 mb8'}`}>
            <span className="t-h2">Vyrovnání</span>
            <span className="badge green"><Send />Připraveno</span>
          </div>
          {settlements.length === 0 && (
            <Card>
              <EmptyState icon={<Send />} title="Všechno je vyrovnané." text="Zatím není potřeba žádný převod." />
            </Card>
          )}
          {settlements.map((settlement, index) => (
            <Card
              className="p-[14px] shadow-[var(--sh-sm)] mb8 pressable"
              key={`${settlement.fromUserId}-${settlement.toUserId}-${index}`}
              onClick={() => (onOpenSettlement ?? setSelectedSettlement)(settlement)}
            >
              <div className="row between">
                <div className="col flex1" style={{ minWidth: 0 }}>
                  <SettlementParticipants settlement={settlement} members={members} />
                  <span className="faint t-xs mt4">{settlement.status === 'CONFIRMED' ? 'Platba potvrzená' : settlement.status === 'PAID' ? 'Čeká na potvrzení příjemcem' : settlement.qrPayload ? 'QR platba připravená' : 'Chybí platební údaje příjemce'}</span>
                </div>
                <div className="col" style={{ alignItems: 'flex-end' }}>
                  <span className="t-h3 tnum">{settlement.amount.toFixed(2)} {settlement.currency}</span>
                  {settlement.status && settlement.status !== 'OPEN' && <span className={`badge ${settlement.status === 'CONFIRMED' ? 'green' : 'amber'} mt4`}>{settlement.status === 'CONFIRMED' ? 'Potvrzeno' : 'Zaplaceno'}</span>}
                </div>
              </div>
              <div className="row g8 mt12">
                <Button
                  className="flex1"
                  size="sm"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    (onOpenSettlement ?? setSelectedSettlement)(settlement);
                  }}
                >
                  {settlement.qrPayload ? <QrCode /> : <AlertTriangle />}Detail platby
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void navigator.clipboard.writeText(settlement.qrPayload ?? `${settlement.fromUserId} -> ${settlement.toUserId}: ${settlement.amount.toFixed(2)} ${settlement.currency}`);
                  }}
                >
                  Zkopírovat
                </Button>
              </div>
            </Card>
          ))}
        </>
      )}

      {mobile && mobileTab === 'expenses' && (
        <>
          <Button className="fab expense-add-fab !h-[54px] !w-[54px]" type="button" onClick={() => setFormOpen(true)} aria-label="Přidat náklad"><Plus /></Button>
          {formOpen && (
            <Sheet open onOpenChange={(open) => !open && setFormOpen(false)}>
              <SheetContent style={{ height: 'auto' }}>
                <div className="grabber" />
                <div className="sheet-head">
                  <SheetTitle className="t-h3">Nový náklad</SheetTitle>
                  <Button variant="ghost" size="sm" type="button" onClick={() => setFormOpen(false)}>Zavřít</Button>
                </div>
                <form className="px18" style={{ paddingBottom: 18 }} onSubmit={handleSubmit}>
                  <ExpenseFields idPrefix="sheet" members={members} />
                </form>
              </SheetContent>
            </Sheet>
          )}
        </>
      )}
      {mobile && <SettlementPaymentSheet settlement={selectedSettlement} members={members} onClose={() => setSelectedSettlement(null)} onStatusChange={onUpdateSettlementStatus} />}
    </div>
  );
}
