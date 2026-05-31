'use client';

import { Bot, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { TabKey, TripAiInsights } from '../types';

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

export function AiInsightsPanel({
  insights,
  compact = false,
  onGenerate,
  onNavigate,
  loading = false,
}: {
  insights?: TripAiInsights | null;
  compact?: boolean;
  onGenerate: () => void;
  onNavigate?: (tab: TabKey) => void;
  loading?: boolean;
}) {
  const items = insights?.insights ?? [];
  if (compact) {
    return (
      <Card className="p-[12px] shadow-[var(--sh-sm)] mb12">
        <div className="row between g10">
          <span className="t-h3 row g6"><Bot size={16} />AI plánovač</span>
          <Button size="sm" variant="outline" type="button" onClick={onGenerate} disabled={loading}><Sparkles size={14} />{loading ? 'Běží' : 'Spustit'}</Button>
        </div>
        {insights?.summary && <span className="muted t-sm mt8">{insights.summary}</span>}
        {items.length > 0 && (
          <div className="row g6 mt10 wrap">
            {items.slice(0, 3).map((item) => (
              <button className={`badge ${severityClass(item.severity)}`} key={`${item.area}-${item.title}`} type="button" onClick={() => onNavigate?.(item.target)}>
                {item.title}
              </button>
            ))}
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="p-[16px] shadow-[var(--sh-sm)]">
      <div className="row between g10 mb12">
        <div className="col">
          <span className="t-h3 row g6"><Bot size={16} />AI plánovač</span>
          <span className="muted t-xs mt4">{insights ? `${insights.model} · ${new Date(insights.generatedAt).toLocaleString('cs-CZ')}` : 'Agent projde trip a navrhne další kroky.'}</span>
        </div>
        <Button size="sm" variant="outline" type="button" onClick={onGenerate} disabled={loading}><Sparkles size={14} />{loading ? 'Běží' : 'Spustit'}</Button>
      </div>

      {insights?.summary ? (
        <p className="t-sm muted mb12">{insights.summary}</p>
      ) : (
        <p className="t-sm muted mb12">Bez deterministického score. Výstup vznikne až po zavolání OpenAI agenta nad aktuálním tripem.</p>
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
    </Card>
  );
}
