'use client';

import { Bot, ChevronRight, MapPinPlus, Route, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { TabKey, TripAiInsights, TripAiPlanDraft, TripAiSuggestions } from '../types';

function severityClass(severity: string) {
  if (severity === 'CRITICAL') return 'red';
  if (severity === 'WARNING') return 'amber';
  return 'muted';
}

function areaLabel(area: string) {
  const labels: Record<string, string> = {
    MAP: 'Mapa',
    ITINERARY: 'Itinerář',
    STAY: 'Ubytování',
    COSTS: 'Náklady',
    WEATHER: 'Počasí',
    TRANSPORT: 'Doprava',
    GROUP: 'Skupina',
  };
  return labels[area] ?? area;
}

function verificationClass(status: string) {
  if (status === 'VERIFIED') return 'green';
  if (status === 'PARTIAL') return 'amber';
  return 'muted';
}

function verificationLabel(status: string) {
  if (status === 'VERIFIED') return 'Ověřeno';
  if (status === 'PARTIAL') return 'Částečně';
  return 'Neověřeno';
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    PLACE: 'Místo',
    FOOD: 'Jídlo',
    ACTIVITY: 'Aktivita',
    DAY_TRIP: 'Výlet',
    TRANSPORT: 'Doprava',
    CUSTOM: 'Vlastní',
  };
  return labels[type] ?? type;
}

function durationLabel(minutes: number | null) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function timeLabel(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

export function AiInsightsPanel({
  insights,
  compact = false,
  onGenerate,
  suggestions,
  planDraft,
  onGenerateSuggestions,
  onGeneratePlanDraft,
  onNavigate,
  onDismiss,
  loading = false,
  loadingSuggestions = false,
  loadingPlanDraft = false,
  compactDetails = true,
}: {
  insights?: TripAiInsights | null;
  suggestions?: TripAiSuggestions | null;
  planDraft?: TripAiPlanDraft | null;
  compact?: boolean;
  onGenerate: () => void;
  onGenerateSuggestions?: () => void;
  onGeneratePlanDraft?: () => void;
  onNavigate?: (tab: TabKey) => void;
  onDismiss?: () => void;
  loading?: boolean;
  loadingSuggestions?: boolean;
  loadingPlanDraft?: boolean;
  compactDetails?: boolean;
}) {
  const items = insights?.insights ?? [];
  const candidates = suggestions?.candidates ?? planDraft?.candidates ?? [];
  const summary = planDraft?.summary ?? suggestions?.summary ?? insights?.summary;
  if (compact) {
    return (
      <Card className="p-[12px] shadow-[var(--sh-sm)] mb12">
        <div className="col between g10">
          <div className="t-h3 row g6 flex w-full"><Bot size={16} />AI plánovač</div>
          <div className="row g6 wrap">
            <Button size="sm" variant="outline" type="button" onClick={onGenerate} disabled={loading}><Sparkles size={14} />{loading ? 'Běží' : 'Kontrola'}</Button>
            {onGenerateSuggestions && <Button size="sm" variant="outline" type="button" onClick={onGenerateSuggestions} disabled={loadingSuggestions}><MapPinPlus size={14} />{loadingSuggestions ? 'Běží' : 'Místa'}</Button>}
            {onGeneratePlanDraft && <Button size="sm" variant="outline" type="button" onClick={onGeneratePlanDraft} disabled={loadingPlanDraft}><Route size={14} />{loadingPlanDraft ? 'Běží' : 'Plán'}</Button>}
            {onDismiss && (suggestions || planDraft) && <Button size="icon" variant="ghost" type="button" title="Skrýt AI návrhy" onClick={onDismiss}><X /></Button>}
          </div>
        </div>
        {summary && <span className="muted t-sm mt8">{summary}</span>}
        {items.length > 0 && (
          <div className="row g6 mt10 wrap">
            {items.slice(0, 3).map((item) => (
              <button className={`badge ${severityClass(item.severity)}`} key={`${item.area}-${item.title}`} type="button" onClick={() => onNavigate?.(item.target)}>
                {item.title}
              </button>
            ))}
          </div>
        )}
        {compactDetails && planDraft?.days?.length ? (
          <div className="col g8 mt10">
            {planDraft.days.slice(0, 2).map((day) => (
              <div className="softbox" key={`${day.date}-${day.title}`}>
                <div className="row between g8">
                  <span className="t-xs semib">{day.title}</span>
                  <span className="muted t-xs">{new Date(day.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}</span>
                </div>
                <span className="muted t-xs mt2">{day.theme}</span>
                <div className="col mt6">
                  {day.items.slice(0, 3).map((item) => (
                    <div className="row g8" key={item.id}>
                      <span className="muted t-xs" style={{ width: 42 }}>{timeLabel(item.startsAt)}</span>
                      <span className="t-xs flex1">{item.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {compactDetails && candidates.length > 0 && (
          <div className="col g8 mt10">
            {candidates.slice(0, 3).map((candidate) => (
              <div className="softbox" key={candidate.id}>
                <div className="row between g8">
                  <span className="t-sm semib" style={{ minWidth: 0 }}>{candidate.name}</span>
                  <span className={`badge ${verificationClass(candidate.verification.status)}`}>{verificationLabel(candidate.verification.status)}</span>
                </div>
                <div className="row g6 mt6 wrap">
                  <span className="badge muted">{typeLabel(candidate.type)}</span>
                  <span className="badge muted">{candidate.weatherSuitability === 'OUTDOOR' ? 'Venku' : candidate.weatherSuitability === 'INDOOR' ? 'Uvnitř' : 'Mix'}</span>
                  {durationLabel(candidate.estimatedDurationMin) && <span className="badge muted">{durationLabel(candidate.estimatedDurationMin)}</span>}
                  <span className="badge muted">{Math.round(candidate.confidence * 100)} %</span>
                </div>
                <span className="muted t-xs mt6">{candidate.reason}</span>
                <span className="muted t-xs mt4">{candidate.verification.provider ? `${candidate.verification.provider}${candidate.verification.latitude && candidate.verification.longitude ? ` · ${candidate.verification.latitude.toFixed(4)}, ${candidate.verification.longitude.toFixed(4)}` : ''}` : candidate.searchQuery}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-[16px] shadow-[var(--sh-sm)]">
      <div className="col between g10 mb12">
        <div className="col flex-1">
          <div className="t-h3 row g6 flex w-max"><Bot size={16} />AI plánovač</div>
          <span className="muted t-xs mt4">{insights ? `${insights.model} · ${new Date(insights.generatedAt).toLocaleString('cs-CZ')}` : 'Agent projde výlet a navrhne další kroky.'}</span>
        </div>
        <div className="row g6 wrap" style={{ justifyContent: 'flex-end' }}>
          <Button size="sm" variant="outline" type="button" onClick={onGenerate} disabled={loading}><Sparkles size={14} />{loading ? 'Běží' : 'Zkontrolovat'}</Button>
          {onGenerateSuggestions && <Button size="sm" variant="outline" type="button" onClick={onGenerateSuggestions} disabled={loadingSuggestions}><MapPinPlus size={14} />{loadingSuggestions ? 'Běží' : 'Navrhnout místa'}</Button>}
          {onGeneratePlanDraft && <Button size="sm" variant="outline" type="button" onClick={onGeneratePlanDraft} disabled={loadingPlanDraft}><Route size={14} />{loadingPlanDraft ? 'Běží' : 'Navrhnout plán'}</Button>}
        </div>
      </div>

      {summary ? (
        <p className="t-sm muted mb12">{summary}</p>
      ) : (
        <p className="t-sm muted mb12">Bez deterministického skóre. Výstup vznikne až po zavolání OpenAI agenta nad aktuálním výletem.</p>
      )}

      {items.length > 0 && (
        <div className="col">
          {items.map((item, index) => (
            <div key={`${item.area}-${item.title}`}>
              {index > 0 && <hr className="sep" />}
              <button className="row pressable w-full text-left" type="button" style={{ padding: '11px 0' }} onClick={() => onNavigate?.(item.target)}>
                <span className={`badge ${severityClass(item.severity)}`}>{areaLabel(item.area)}</span>
                <div className="col flex1" style={{ minWidth: 0 }}>
                  <span className="t-sm semib">{item.title}</span>
                  <span className="muted t-xs mt2">{item.detail}</span>
	                  <span className="t-xs mt4">{item.recommendedAction}</span>
	                  {item.actions?.length ? (
	                    <span className="row g6 mt6 wrap">
	                      {item.actions.map((action) => <span className="badge muted" key={`${item.title}-${action.type}-${action.label}`}>{action.label}</span>)}
	                    </span>
	                  ) : null}
                </div>
                <ChevronRight size={16} color="var(--faint-fg)" />
              </button>
            </div>
          ))}
        </div>
      )}

      {candidates.length > 0 && (
        <>
          <hr className="sep mt14 mb12" />
          <div className="row between mb8">
            <span className="t-h3">Návrhy míst</span>
            <span className="badge muted">{candidates.length}</span>
          </div>
          <div className="col">
            {candidates.slice(0, 8).map((candidate, index) => (
              <div key={candidate.id}>
                {index > 0 && <hr className="sep" />}
                <div className="row" style={{ padding: '10px 0', alignItems: 'flex-start' }}>
                  <span className={`badge ${verificationClass(candidate.verification.status)}`}>{verificationLabel(candidate.verification.status)}</span>
                  <div className="col flex1" style={{ minWidth: 0 }}>
                    <span className="t-sm semib">{candidate.name}</span>
                    <span className="row g6 mt4 wrap">
                      <span className="badge muted">{typeLabel(candidate.type)}</span>
                      <span className="badge muted">{candidate.weatherSuitability === 'OUTDOOR' ? 'Venku' : candidate.weatherSuitability === 'INDOOR' ? 'Uvnitř' : 'Mix'}</span>
                      {durationLabel(candidate.estimatedDurationMin) && <span className="badge muted">{durationLabel(candidate.estimatedDurationMin)}</span>}
                      <span className="badge muted">{Math.round(candidate.confidence * 100)} %</span>
                    </span>
                    <span className="muted t-xs mt2">{candidate.reason}</span>
                    <span className="muted t-xs mt4">{candidate.verification.description ?? candidate.searchQuery}</span>
                    <span className="muted t-xs mt4">{candidate.verification.provider ? `${candidate.verification.provider}${candidate.verification.latitude && candidate.verification.longitude ? ` · ${candidate.verification.latitude.toFixed(4)}, ${candidate.verification.longitude.toFixed(4)}` : ''}` : candidate.searchQuery}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {planDraft?.days?.length ? (
        <>
          <hr className="sep mt14 mb12" />
          <div className="row between mb8">
            <span className="t-h3">Draft plánu</span>
            <span className="badge muted">{planDraft.days.length} dnů</span>
          </div>
          <div className="col g10">
            {planDraft.days.slice(0, 5).map((day) => (
              <div className="softbox" key={`${day.date}-${day.title}`}>
                <div className="row between g8">
                  <span className="t-sm semib">{day.title}</span>
                  <span className="muted t-xs">{day.date}</span>
                </div>
                <span className="muted t-xs mt2">{day.theme}</span>
                <div className="col mt8">
                  {day.items.slice(0, 4).map((item) => (
                    <div className="row g8" key={item.id}>
                      <span className="muted t-xs" style={{ width: 42 }}>{timeLabel(item.startsAt)}</span>
                      <span className="t-xs flex1">{item.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </Card>
  );
}
