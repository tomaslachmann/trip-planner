'use client';

import { Banknote, Clock, MapPin, MessageCircle, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import { normalizePlaceStatus, placeRecommendationScore, placeStatusMeta, type PlaceStatus } from '../lib/decision';
import type { Place } from '../types';
import { CategoryBadge } from './category';

function voteCounts(place: Place) {
  const values = place.votes ?? [];
  return {
    must: values.filter((vote) => vote.value === 'MUST_HAVE').length,
    up: values.filter((vote) => vote.value === 'UP').length,
    maybe: values.filter((vote) => vote.value === 'MAYBE').length,
    down: values.filter((vote) => vote.value === 'DOWN').length,
  };
}

export function PlaceDetailPanel({ planner, compact = false }: { planner: TripPlannerController; compact?: boolean }) {
  const { state, actions } = planner;
  const place = state.selectedPlace;
  const [commentText, setCommentText] = useState('');

  if (!place) {
    return (
      <div className="p18 center muted t-sm" style={{ height: '100%' }}>
        Vyber pin nebo místo ze seznamu.
      </div>
    );
  }

  const counts = voteCounts(place);
  const myVote = place.votes?.find((vote) => vote.userId === state.actorUserId)?.value;
  const hasCommentDraft = commentText.trim().length > 0;
  const members = state.selectedTrip?.members ?? [];
  const votedUserIds = new Set((place.votes ?? []).map((vote) => vote.userId));
  const missingVoters = members.filter((member) => !votedUserIds.has(member.userId));
  const status = normalizePlaceStatus(place.status);
  const statusMeta = placeStatusMeta[status];
  const score = placeRecommendationScore(place, members);
  const canChangeStatus = place.createdById === state.actorUserId || state.actorMember?.role === 'OWNER' || state.actorMember?.role === 'ADMIN';
  const statusActions: Array<{ status: PlaceStatus; label: string }> = [
    { status: 'SHORTLISTED', label: 'Shortlist' },
    { status: 'APPROVED', label: 'Schválit' },
    { status: 'REJECTED', label: 'Zamítnout' },
  ];

  return (
    <div className="col" style={{ height: '100%', minHeight: 0 }}>
      <div className="scroll p18" style={{ flex: 1 }}>
        <div className="receipt center" style={{ height: compact ? 118 : 156, borderRadius: 14, border: '1px solid var(--border)' }}>
          <span className="row g6 t-xs mono muted"><MapPin />foto místa</span>
        </div>
        <div className="row between g8 mt16">
          <CategoryBadge type={place.type} />
          <div className="row g6 wrap" style={{ justifyContent: 'flex-end' }}>
            <span className={`badge ${statusMeta.cls}`}>{statusMeta.label}</span>
            <span className="badge solid">Score {score}</span>
            <span className="badge muted">{place.votes?.length ?? 0} hlasů</span>
          </div>
        </div>
        <h2 className={compact ? 't-h2 mt12' : 't-title mt12'}>{place.name}</h2>
        <div className="row g10 mt8 muted t-sm wrap">
          <span className="row g4"><Clock />{place.durationMin ?? 90} min</span>
          <span className="row g4"><Banknote />{place.estimatedCost ?? 'Zdarma'}</span>
          <span className="row g4"><MapPin />{state.selectedTrip?.destination ?? 'Destinace'}</span>
        </div>
        {place.description && <p className="t-body mt14" style={{ color: '#3f3f46' }}>{place.description}</p>}
        {place.sourceUrl && <p className="t-xs mt8 ellipsis"><a href={place.sourceUrl} target="_blank" rel="noreferrer">{place.sourceUrl}</a></p>}

        <hr className="sep mt20" />
        <div className="row between mt16 mb10">
          <span className="t-h3">Hlasování skupiny</span>
          <span className="muted t-xs">{votedUserIds.size}/{members.length || '?'} hlasovalo</span>
        </div>
        {missingVoters.length > 0 && (
          <div className="badge muted mb10" style={{ maxWidth: '100%', justifyContent: 'flex-start' }}>
            Čeká: {missingVoters.map((member) => member.user.name).join(', ')}
          </div>
        )}
        <div className="votes">
          <button className={`votebtn ${myVote === 'MUST_HAVE' ? 'on must' : ''}`} type="button" onClick={() => void actions.voteForPlace(place.id, 'MUST_HAVE')}><span className="vn tnum">{counts.must}</span><span className="row g4"><Star />Nutné</span></button>
          <button className={`votebtn ${myVote === 'UP' ? 'on' : ''}`} type="button" onClick={() => void actions.voteForPlace(place.id, 'UP')}><span className="vn tnum">{counts.up}</span><span className="row g4"><ThumbsUp />Pro</span></button>
          <button className={`votebtn ${myVote === 'MAYBE' ? 'on' : ''}`} type="button" onClick={() => void actions.voteForPlace(place.id, 'MAYBE')}><span className="vn tnum">{counts.maybe}</span><span>Možná</span></button>
          <button className={`votebtn ${myVote === 'DOWN' ? 'on' : ''}`} type="button" onClick={() => void actions.voteForPlace(place.id, 'DOWN')}><span className="vn tnum">{counts.down}</span><span className="row g4"><ThumbsDown />Ne</span></button>
        </div>
        {canChangeStatus && (
          <div className="row g8 mt12 wrap">
            {statusActions.map((item) => (
              <Button key={item.status} size="sm" variant={status === item.status ? 'secondary' : 'outline'} type="button" onClick={() => void actions.updatePlaceStatus(place.id, item.status)}>
                {item.label}
              </Button>
            ))}
          </div>
        )}

        <hr className="sep mt20" />
        <div className="row between mt16 mb12"><span className="t-h3">Komentáře</span><span className="badge muted">{place.comments?.length ?? 0}</span></div>
        <div className="col g12">
          {(place.comments ?? []).map((comment) => (
            <Card className="p-[14px]" key={comment.id ?? `${comment.userId}-${comment.body}`}>
              <span className="t-sm">{comment.body}</span>
            </Card>
          ))}
        </div>
        <div className="relative mt8" style={{ marginBottom: 18 }}>
          <MessageCircle className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 bg-muted border-transparent" placeholder="Přidat komentář..." value={commentText} onChange={(event) => setCommentText(event.target.value)} />
        </div>
      </div>
      <div className="row g8 p16" style={{ borderTop: '1px solid var(--border)', flex: '0 0 auto' }}>
        <Button className="flex1" type="button" onClick={() => {
          if (hasCommentDraft) {
            void actions.commentOnPlace(place.id, commentText).then(() => setCommentText(''));
            return;
          }
          void actions.addPlaceToItinerary(place.id);
        }}>{hasCommentDraft ? 'Přidat komentář' : 'Přidat do itineráře'}</Button>
        <Button variant="outline" size="icon" type="button" onClick={() => void actions.commentOnPlace(place.id, commentText).then(() => setCommentText(''))} disabled={!hasCommentDraft}><MessageCircle /></Button>
      </div>
    </div>
  );
}
