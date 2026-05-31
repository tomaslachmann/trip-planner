'use client';

import { ArrowLeft, Lock, Plus, Vote } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import type { Poll, TripMember } from '../types';
import { ConfirmDestructiveAction } from './confirm-destructive-action';

function PollCard({
  poll,
  actorUserId,
  members,
  onVote,
  onUnvote,
  onStatusChange,
  onDelete,
}: {
  poll: Poll;
  actorUserId: string;
  members: TripMember[];
  onVote: (optionId: string) => void;
  onUnvote: (optionId: string) => void;
  onStatusChange: (pollId: string, status: Poll['status']) => void;
  onDelete: (pollId: string) => void;
}) {
  const total = Math.max(1, (poll.options ?? []).reduce((sum, option) => sum + (option.votes?.length ?? 0), 0));
  const votedUserIds = new Set((poll.options ?? []).flatMap((option) => (option.votes ?? []).map((vote) => vote.userId)));
  const missingVoters = members.filter((member) => !votedUserIds.has(member.userId));
  return (
    <Card className="p-[14px] mb12 shadow-[var(--sh-sm)]">
      <div className="row between mb12">
        <div className="col flex1" style={{ minWidth: 0 }}>
          <span className="t-h3">{poll.question}</span>
          <span className="faint t-xs mt4">{poll.multiChoice ? 'Více možností' : 'Jedna možnost'} · {poll.status === 'OPEN' ? 'otevřeno' : 'uzavřeno'}</span>
        </div>
        <div className="row g6">
          <Button variant="ghost" size="sm" type="button" onClick={() => onStatusChange(poll.id, poll.status === 'OPEN' ? 'CLOSED' : 'OPEN')}>
            <Lock size={14} />{poll.status === 'OPEN' ? 'Zavřít' : 'Otevřít'}
          </Button>
          <ConfirmDestructiveAction iconOnly label="Smazat anketu" size="icon" onConfirm={() => onDelete(poll.id)} />
        </div>
      </div>
      <div className="row g8 wrap mb12">
        <span className="badge muted">{votedUserIds.size}/{members.length || votedUserIds.size} hlasovalo</span>
        {missingVoters.length > 0 && (
          <span className="badge amber">Čeká: {missingVoters.slice(0, 3).map((member) => member.user.name).join(', ')}{missingVoters.length > 3 ? ` +${missingVoters.length - 3}` : ''}</span>
        )}
      </div>
      <div className="col g8">
        {(poll.options ?? []).map((option) => {
          const count = option.votes?.length ?? 0;
          const pct = Math.round((count / total) * 100);
          const mine = option.votes?.some((vote) => vote.userId === actorUserId);
          return (
            <button
              className="poll-option"
              data-selected={mine || undefined}
              disabled={poll.status !== 'OPEN'}
              key={option.id}
              type="button"
              onClick={() => mine ? onUnvote(option.id) : onVote(option.id)}
            >
              <span className="poll-fill" style={{ width: `${pct}%` }} />
              <span className="row between rel">
                <span className="t-sm medi">{option.title}</span>
                <span className="t-sm semib tnum">{pct}%</span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function CreatePollSheet({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (input: { question: string; options: string[]; multiChoice?: boolean }) => void }) {
  const [multiChoice, setMultiChoice] = useState(false);
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent style={{ height: 'auto' }}>
        <div className="grabber" />
        <div className="sheet-head">
          <SheetTitle className="t-h3">Nová anketa</SheetTitle>
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>Zavřít</Button>
        </div>
        <form
          className="px18"
          style={{ paddingBottom: 18 }}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
	            onCreate({
	              question: String(data.get('question') ?? ''),
	              options: [String(data.get('option1') ?? ''), String(data.get('option2') ?? ''), String(data.get('option3') ?? '')],
	              multiChoice,
	            });
            onClose();
          }}
        >
          <label className="field-label" htmlFor="pollQuestion">Otázka</label>
          <Input id="pollQuestion" name="question" placeholder="Kam pojedeme druhý den?" />
          <label className="field-label mt14" htmlFor="pollOption1">Možnosti</label>
	          <div className="col g8">
	            <Input id="pollOption1" name="option1" placeholder="Možnost 1" />
	            <Input name="option2" placeholder="Možnost 2" />
	            <Input name="option3" placeholder="Možnost 3" />
	          </div>
	          <label className="row g8 mt14 pressable" style={{ justifyContent: 'flex-start' }}>
	            <Checkbox checked={multiChoice} onCheckedChange={(checked) => setMultiChoice(checked === true)} />
	            <Label>Umožnit více odpovědí</Label>
	          </label>
	          <Button className="mt16 w-full" type="submit">Vytvořit anketu</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function PollsPanel({
  polls,
  actorUserId,
  members = [],
  onCreate,
  onVote,
  onUnvote,
  onStatusChange,
  onDelete,
  onBack,
  desktop = false,
}: {
  polls: Poll[];
  actorUserId: string;
  members?: TripMember[];
  onCreate: (input: { question: string; options: string[]; multiChoice?: boolean }) => void;
  onVote: (optionId: string) => void;
  onUnvote: (optionId: string) => void;
  onStatusChange: (pollId: string, status: Poll['status']) => void;
  onDelete: (pollId: string) => void;
  onBack?: () => void;
  desktop?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const pollsList = (
    <>
      {polls.length === 0 && (
        <Card>
          <EmptyState icon={<Vote />} title="Zatím tu nejsou ankety." text="Vytvoř otázku pro skupinu a nechte rozhodnout hlasováním." />
        </Card>
      )}
      {polls.map((poll) => (
        <PollCard
          actorUserId={actorUserId}
          members={members}
          key={poll.id}
          poll={poll}
          onVote={onVote}
          onUnvote={onUnvote}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
        />
      ))}
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
          <Button size="sm" type="button" onClick={() => setOpen(true)}><Plus />Nová anketa</Button>
        </div>
        <div className="t-h2 mb12">Hlasování</div>
        {pollsList}
        <CreatePollSheet open={open} onClose={() => setOpen(false)} onCreate={onCreate} />
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="appbar">
        {onBack && <Button size="icon" variant="ghost" type="button" onClick={onBack}><ArrowLeft /></Button>}
        <span className="t-h3 flex1">Hlasování</span>
        <Button size="sm" type="button" onClick={() => setOpen(true)}><Plus />Nová anketa</Button>
      </div>
      <div className="scroll px18" style={{ flex: 1, paddingTop: 12, paddingBottom: 18 }}>
        {pollsList}
      </div>
      <CreatePollSheet open={open} onClose={() => setOpen(false)} onCreate={onCreate} />
    </div>
  );
}
