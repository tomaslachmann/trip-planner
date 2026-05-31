'use client';

import { Activity, CheckCircle2, ChevronRight, Link, ListChecks, Settings, Users, Vote } from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { AvatarRow } from './avatar';
import { AiInsightsPanel } from './ai-insights-panel';
import { useModal } from '../context/modal-context';
import { ChecklistPanel } from './checklist-panel';
import { PollsPanel } from './polls-panel';
import { formatTripRange } from '../lib/format';
import type { TripPlannerController } from '../hooks/use-trip-planner';

type Section = 'menu' | 'polls' | 'checklist';

const mobileItems = [
  { key: 'members',      label: 'Členové',         icon: Users },
  { key: 'tripsettings', label: 'Nastavení tripu',  icon: Settings },
  { key: 'invite',       label: 'Odkaz na pozvánku',icon: Link },
  { key: 'polls',        label: 'Hlasování',        icon: Vote },
  { key: 'checklist',    label: 'Checklist',        icon: ListChecks },
] as const;

type DesktopSettingItem = { key: string; label: string; icon: string };
const desktopSettings: DesktopSettingItem[] = [
  { key: 'invite',       label: 'Odkaz na pozvánku', icon: 'link' },
  { key: 'tripsettings', label: 'Nastavení tripu',   icon: 'settings' },
  { key: 'polls',        label: 'Hlasování',          icon: 'vote' },
];

export function MoreScreen({ planner, desktop = false }: { planner: TripPlannerController; desktop?: boolean }) {
  const { state, actions } = planner;
  const [section, setSection] = useState<Section>('menu');
  const [inviteCopied, setInviteCopied] = useState(false);

  const approved = state.data.places.filter((p) => (p.votes ?? []).some((v) => v.value === 'MUST_HAVE' || v.value === 'UP')).length;
  const totalSettlements = state.data.settlements.reduce((sum, s) => sum + s.amount, 0);
  const activity = state.data.activity.slice(0, desktop ? 8 : 5);

  const { openModal } = useModal();

  function handleNav(key: string) {
    if (key === 'members') actions.setActiveTab('members');
    if (key === 'polls') actions.setActiveTab('polls');
    if (key === 'checklist') actions.setActiveTab('checklist');
    if (key === 'tripsettings') openModal('tripSettings');
    if (key === 'invite' && state.selectedTrip?.inviteCode) {
      void navigator.clipboard.writeText(state.selectedTrip.inviteCode).then(() => {
        setInviteCopied(true);
        window.setTimeout(() => setInviteCopied(false), 1400);
      });
    }
  }

  if (section === 'polls') {
    return (
      <PollsPanel
        desktop={desktop}
        polls={state.data.polls}
        actorUserId={state.actorUserId}
        members={state.selectedTrip?.members ?? []}
        onBack={() => setSection('menu')}
        onCreate={(input) => void actions.createPoll(input)}
        onVote={(optionId) => void actions.votePollOption(optionId)}
        onUnvote={(optionId) => void actions.unvotePollOption(optionId)}
        onStatusChange={(pollId, status) => void actions.updatePoll(pollId, { status })}
        onDelete={(pollId) => void actions.deletePoll(pollId)}
      />
    );
  }

  if (section === 'checklist') {
    return (
      <ChecklistPanel
        desktop={desktop}
        items={state.data.checklist}
        actorUserId={state.actorUserId}
        members={state.selectedTrip?.members ?? []}
        onBack={() => setSection('menu')}
        onCreate={(input) => void actions.createChecklistItem(input)}
        onUpdate={(itemId, input) => void actions.updateChecklistItem(itemId, input)}
        onDelete={(itemId) => void actions.deleteChecklistItem(itemId)}
        onComplete={(itemId, completed) => void actions.completeChecklistItem(itemId, completed)}
      />
    );
  }

  /* ── Desktop version ── */
  if (desktop) {
    return (
      <div className="desk-body">
        <div className="desk-scroll">
          <div className="maxw" style={{ maxWidth: 820 }}>
            <h1 className="desk-h mb16">Přehled tripu</h1>
            <div className="card sh pad mb16">
              <div className="row between">
                <div className="col">
                  <span className="t-h2">{state.selectedTrip?.name ?? 'Trip'}</span>
                  <span className="muted t-sm mt4">{state.selectedTrip?.destination ?? '—'} · {formatTripRange(state.selectedTrip)}</span>
                </div>
                <AvatarRow names={(state.selectedTrip?.members ?? []).map((m) => m.user.name)} />
              </div>
              <div className="row g8 mt14">
                <span className="badge green"><CheckCircle2 size={12} />{approved} schváleno</span>
                <span className="badge amber tnum">€{Math.round(totalSettlements)} nevyrovnáno</span>
                <span className="badge muted">{state.selectedTrip?.members?.length ?? 0} lidí</span>
              </div>
            </div>

            <AiInsightsPanel insights={state.data.aiInsights} loading={state.generatingInsights} onGenerate={() => void actions.generateTripInsights()} onNavigate={actions.setActiveTab} />

            <div className="card sh mt16" style={{ padding: '4px 16px' }}>
              {desktopSettings.map((item, i) => (
                <div key={item.key}>
                  {i > 0 && <hr className="sep" />}
                  <div
                    className="row pressable"
                    style={{ padding: '14px 0', cursor: 'pointer' }}
                    onClick={() => handleNav(item.key)}
                  >
                    <div className="lead-ic" style={{ width: 32, height: 32, borderRadius: 9 }}>
                      {item.key === 'invite' && <Link size={17} />}
                      {item.key === 'tripsettings' && <Settings size={17} />}
                      {item.key === 'polls' && <Vote size={17} />}
                    </div>
                    <span className="t-body flex1 medi">{item.key === 'invite' && inviteCopied ? 'Kód zkopírován' : item.label}</span>
                    <ChevronRight size={18} color="var(--faint-fg)" />
                  </div>
                </div>
              ))}
            </div>

            <Card className="p-[16px] shadow-[var(--sh-sm)] mt16">
              <div className="row between mb8">
                <span className="t-h3 row g6"><Activity size={16} />Aktivita</span>
                <span className="badge muted">{state.data.activity.length}</span>
              </div>
              {activity.length === 0 ? (
                <span className="muted t-sm">Zatím žádné změny.</span>
              ) : activity.map((event, index) => (
                <div key={event.id}>
                  {index > 0 && <hr className="sep" />}
                  <div className="row between g12" style={{ padding: '10px 0' }}>
                    <div className="col flex1" style={{ minWidth: 0 }}>
                      <span className="t-sm semib ellipsis">{event.label}</span>
                      <span className="faint t-xs mt2">{event.actor?.name ?? 'Systém'} · {new Date(event.createdAt).toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <span className="badge muted">{event.entityType ?? 'trip'}</span>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    );
  }

  /* ── Mobile version ── */
  return (
    <div className="screen">
      <div className="appbar flush" style={{ paddingTop: 6 }}>
        <span className="t-title flex1">Více</span>
      </div>
      <div className="scroll px18" style={{ flex: 1, paddingBottom: 18 }}>
        <div className="card sh pad">
          <div className="row between">
            <div className="col" style={{ minWidth: 0 }}>
              <span className="t-h2" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state.selectedTrip?.name ?? 'Trip'}</span>
              <span className="muted t-xs mt4">{state.selectedTrip?.destination ?? '—'} · {formatTripRange(state.selectedTrip)}</span>
            </div>
            <AvatarRow names={(state.selectedTrip?.members ?? []).map((m) => m.user.name)} />
          </div>
          <div className="row g8 mt14 wrap">
            <span className="badge green"><CheckCircle2 size={12} />{approved} schváleno</span>
            <span className="badge amber tnum">€{Math.round(totalSettlements)} nevyrovnáno</span>
            <span className="badge muted">{state.selectedTrip?.members?.length ?? 0} lidí</span>
          </div>
        </div>

        <div className="mt16">
          <AiInsightsPanel insights={state.data.aiInsights} loading={state.generatingInsights} onGenerate={() => void actions.generateTripInsights()} onNavigate={actions.setActiveTab} />
        </div>

        <div className="card mt16" style={{ overflow: 'hidden' }}>
          {mobileItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.key}>
                {index > 0 && <hr className="sep" />}
                <div
                  className="row pressable"
                  style={{ padding: '14px 16px', cursor: 'pointer' }}
                  onClick={() => handleNav(item.key)}
                >
                  <div className="lead-ic" style={{ width: 34, height: 34, borderRadius: 9 }}>
                    <Icon size={18} />
                  </div>
                    <span className="t-body flex1 medi">{item.key === 'invite' && inviteCopied ? 'Kód zkopírován' : item.label}</span>
                  <ChevronRight size={18} color="var(--faint-fg)" />
                </div>
              </div>
            );
          })}
        </div>

        <Card className="p-[16px] mt16">
          <div className="row between mb8">
            <span className="t-h3 row g6"><Activity size={16} />Aktivita</span>
            <span className="badge muted">{state.data.activity.length}</span>
          </div>
          {activity.length === 0 ? (
            <span className="muted t-sm">Zatím žádné změny.</span>
          ) : activity.map((event, index) => (
            <div key={event.id}>
              {index > 0 && <hr className="sep" />}
              <div className="col" style={{ padding: '10px 0' }}>
                <span className="t-sm semib">{event.label}</span>
                <span className="faint t-xs mt2">{event.actor?.name ?? 'Systém'} · {new Date(event.createdAt).toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
