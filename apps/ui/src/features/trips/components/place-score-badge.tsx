import { TrendingUp } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { placeScore } from '../lib/decision';
import type { Place } from '../types';

function scoreBadgeMeta(score: number) {
  if (score <= 0) return { mood: 'Bez skóre', cls: 'muted' };
  if (score >= 78) return { mood: 'Nejlepší', cls: 'green' };
  if (score >= 62) return { mood: 'Silné', cls: 'green' };
  if (score >= 40) return { mood: 'Smíšené', cls: 'amber' };
  return { mood: 'Slabé', cls: 'red' };
}

export function ScoreBadge({
  score,
  mood,
  cls,
  className,
  style,
  title,
}: {
  score: number;
  mood?: string;
  cls?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
}) {
  const meta = mood && cls ? { mood, cls } : scoreBadgeMeta(score);

  return (
    <Badge variant="outline" className={cn('badge', meta.cls, className)} style={style} title={title}>
      <TrendingUp size={12} />{score} · {meta.mood}
    </Badge>
  );
}

export function PlaceScoreBadge({ place, className, style }: { place: Place; className?: string; style?: CSSProperties }) {
  const score = placeScore(place);

  return <ScoreBadge score={score.score} mood={score.mood} cls={score.cls} className={className} style={style} title={`${score.voters} hlasů`} />;
}
