'use client';

import { ArrowLeft, CheckSquare2, Edit3, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipButton } from '@/components/ui/chip-group';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import type { ChecklistItem, TripMember } from '../types';
import { ConfirmDestructiveAction } from './confirm-destructive-action';

type ChecklistFilter = 'all' | 'mine' | 'open';

type ChecklistInput = { title: string; note?: string | null; scope?: 'PERSONAL' | 'SHARED' | 'EVERYONE'; dueAt?: string | null; assignedUserIds?: string[] };

function scopeLabel(scope: ChecklistItem['scope']) {
  if (scope === 'PERSONAL') return 'osobní';
  if (scope === 'EVERYONE') return 'každý';
  return 'sdílené';
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function toApiDueDate(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null;
}

function ChecklistItemSheet({
  open,
  item,
  members,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  open: boolean;
  item?: ChecklistItem | null;
  members: TripMember[];
  onClose: () => void;
  onCreate: (input: ChecklistInput) => void;
  onUpdate: (itemId: string, input: ChecklistInput) => void;
  onDelete: (itemId: string) => void;
}) {
  const [scope, setScope] = useState<ChecklistInput['scope']>(item?.scope ?? 'SHARED');
  const [assigned, setAssigned] = useState<Record<string, boolean>>(() => {
    const assignedUserIds = new Set((item?.assignments ?? []).map((assignment) => assignment.userId));
    return Object.fromEntries(members.map((member) => [member.userId, assignedUserIds.size ? assignedUserIds.has(member.userId) : false]));
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent style={{ height: 'auto' }}>
        <div className="grabber" />
        <div className="sheet-head">
          <SheetTitle className="t-h3">{item ? 'Upravit úkol' : 'Nový úkol'}</SheetTitle>
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>Zavřít</Button>
        </div>
        <form
          className="px18"
          style={{ paddingBottom: 18 }}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const input: ChecklistInput = {
              title: String(data.get('title') ?? '').trim(),
              note: String(data.get('note') ?? '').trim() || null,
              scope,
              dueAt: toApiDueDate(String(data.get('dueAt') ?? '')),
              assignedUserIds: Object.entries(assigned).filter(([, enabled]) => enabled).map(([userId]) => userId),
            };
            if (item?.id) onUpdate(item.id, input);
            else onCreate({ ...input, note: input.note ?? undefined, dueAt: input.dueAt ?? undefined });
            onClose();
            event.currentTarget.reset();
          }}
        >
          <Label htmlFor="checklistTitle">Název</Label>
          <Input id="checklistTitle" name="title" defaultValue={item?.title ?? ''} placeholder="Koupit cestovní pojištění" />
          <Label className="mt14" htmlFor="checklistNote">Poznámka</Label>
          <Input id="checklistNote" name="note" defaultValue={item?.note ?? ''} placeholder="Detail nebo termín" />
          <div className="row g12 mt14">
            <div className="flex1">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(value) => setScope(value as ChecklistInput['scope'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHARED">Sdílené</SelectItem>
                  <SelectItem value="PERSONAL">Osobní</SelectItem>
                  <SelectItem value="EVERYONE">Každý</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex1">
              <Label htmlFor="checklistDueAt">Termín</Label>
              <Input id="checklistDueAt" name="dueAt" type="date" defaultValue={toDateInput(item?.dueAt)} />
            </div>
          </div>
          <Label className="mt14">Přiřazení</Label>
          <div className="chips">
            {members.map((member) => (
              <ChipButton
                key={member.userId}
                selected={assigned[member.userId]}
                onClick={() => setAssigned((current) => ({ ...current, [member.userId]: !current[member.userId] }))}
              >
                {member.user.name}
              </ChipButton>
            ))}
          </div>
          {item?.id && (
            <ConfirmDestructiveAction className="mt16 w-full" label="Smazat úkol" confirmLabel="Smazat úkol" onConfirm={() => { onDelete(item.id); onClose(); }} />
          )}
          <Button className="mt12 w-full" type="submit"><Plus />{item ? 'Uložit změny' : 'Přidat úkol'}</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function ChecklistPanel({
  items,
  actorUserId,
  members = [],
  onBack,
  onCreate,
  onUpdate,
  onDelete,
  onComplete,
  desktop = false,
}: {
  items: ChecklistItem[];
  actorUserId: string;
  members?: TripMember[];
  onBack?: () => void;
  onCreate: (input: ChecklistInput) => void;
  onUpdate: (itemId: string, input: ChecklistInput) => void;
  onDelete: (itemId: string) => void;
  onComplete: (itemId: string, completed: boolean) => void;
  desktop?: boolean;
}) {
  const [filter, setFilter] = useState<ChecklistFilter>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ChecklistItem | null>(null);

  const filtered = useMemo(() => items.filter((item) => {
    const doneByMe = item.completions?.some((c) => c.userId === actorUserId) ?? false;
    const assignedToMe = item.assignments?.length ? item.assignments.some((a) => a.userId === actorUserId) : true;
    if (filter === 'mine') return assignedToMe;
    if (filter === 'open') return !doneByMe;
    return true;
  }), [actorUserId, filter, items]);
  const totalAssignedToMe = items.filter((item) => item.assignments?.length ? item.assignments.some((a) => a.userId === actorUserId) : true).length;
  const doneByMe = items.filter((item) => item.completions?.some((completion) => completion.userId === actorUserId)).length;
  const progress = totalAssignedToMe ? Math.round((doneByMe / totalAssignedToMe) * 100) : 0;

  const filterControl = (
    <SegmentedControl
      className="mb16"
      value={filter}
      onValueChange={setFilter}
      options={[
        { value: 'all', label: 'Vše' },
        { value: 'mine', label: 'Moje' },
        { value: 'open', label: 'Otevřené' },
      ]}
    />
  );

  const itemsList = (
    <>
      <Card className="p-[14px] mb12 shadow-[var(--sh-sm)]">
        <div className="row between mb8">
          <span className="t-h3">Můj postup</span>
          <span className="badge green">{doneByMe}/{totalAssignedToMe}</span>
        </div>
        <div className="poll-option" aria-hidden="true">
          <span className="poll-fill" style={{ width: `${progress}%` }} />
          <span className="row between rel">
            <span className="t-sm medi">{progress}% hotovo</span>
            <span className="muted t-xs">{items.length} úkolů celkem</span>
          </span>
        </div>
      </Card>
      {filtered.length === 0 && (
        <Card>
          <EmptyState icon={<CheckSquare2 />} title="Checklist je prázdný." text="Přidej věci k vyřízení před cestou nebo během tripu." />
        </Card>
      )}
      {filtered.map((item) => {
        const done = item.completions?.some((c) => c.userId === actorUserId) ?? false;
        return (
          <Card className="p-[14px] mb10 shadow-[var(--sh-sm)]" key={item.id}>
            <div className="row aic">
              <Checkbox checked={done} onCheckedChange={(checked) => onComplete(item.id, checked === true)} />
              <div className="col flex1" style={{ minWidth: 0 }}>
                <span className={done ? 't-h3 muted' : 't-h3'}>{item.title}</span>
                <span className="muted t-xs mt4">
                  {scopeLabel(item.scope)}
                  {item.dueAt ? ` · do ${new Date(item.dueAt).toLocaleDateString('cs-CZ')}` : ''}
                  {item.note ? ` · ${item.note}` : ''}
                </span>
              </div>
              <span className={done ? 'badge green' : 'badge muted'}>{done ? 'hotovo' : 'čeká'}</span>
              <Button variant="ghost" size="icon" type="button" onClick={() => { setEditing(item); setOpen(true); }} aria-label="Upravit úkol">
                <Edit3 />
              </Button>
            </div>
          </Card>
        );
      })}
    </>
  );

  if (desktop) {
    return (
      <div style={{ padding: '24px 26px' }}>
        <div className="row between mb16">
          {onBack && (
            <Button variant="ghost" size="sm" type="button" onClick={onBack}><ArrowLeft />Zpět na Více</Button>
          )}
          <div className="flex1" />
          <Button size="sm" type="button" onClick={() => { setEditing(null); setOpen(true); }}><Plus />Nový úkol</Button>
        </div>
        <div className="t-h2 mb12">Checklist</div>
        {filterControl}
        {itemsList}
        <ChecklistItemSheet key={editing?.id ?? 'new'} open={open} item={editing} members={members} onClose={() => { setOpen(false); setEditing(null); }} onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete} />
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="appbar">
        {onBack && <Button size="icon" variant="ghost" type="button" onClick={onBack}><ArrowLeft /></Button>}
        <span className="t-h3 flex1">Checklist</span>
        <Button size="sm" type="button" onClick={() => { setEditing(null); setOpen(true); }}><Plus />Nový úkol</Button>
      </div>
      <div className="scroll px18" style={{ flex: 1, paddingTop: 12, paddingBottom: 18 }}>
        {filterControl}
        {itemsList}
      </div>
      <ChecklistItemSheet key={editing?.id ?? 'new'} open={open} item={editing} members={members} onClose={() => { setOpen(false); setEditing(null); }} onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete} />
    </div>
  );
}
