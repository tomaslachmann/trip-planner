'use client';

import { ArrowLeft, Banknote, Bookmark, CalendarPlus, Check, Clock, ExternalLink, MapPin, MessageCircle, Pencil, Star, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import { normalizePlaceStatus, placeStatusMeta, type PlaceStatus } from '../lib/decision';
import { externalMapUrl } from '../lib/map-links';
import { canManageTrip } from '../lib/permissions';
import type { Place } from '../types';
import { useModal } from '../context/modal-context';
import { Avatar } from './avatar';
import { CategoryBadge } from './category';
import { PlaceImage } from './place-image';
import { PlaceScoreBadge } from './place-score-badge';
import { StatusActionButton, type StatusTone } from './status-action-button';

function voteCounts(place: Place) {
  const values = place.votes ?? [];
  return {
    must: values.filter((vote) => vote.value === 'MUST_HAVE').length,
    up: values.filter((vote) => vote.value === 'UP').length,
    maybe: values.filter((vote) => vote.value === 'MAYBE').length,
    down: values.filter((vote) => vote.value === 'DOWN').length,
  };
}

function formatPlaceCost(value: Place['estimatedCost'], currency?: string) {
  if (value === null || value === undefined || value === '') return 'Zdarma';
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric <= 0) return 'Zdarma';
  return `${value} ${currency ?? ''}`.trim();
}

function formatCommentTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function commentAuthorName(comment: NonNullable<Place['comments']>[number]) {
  return comment.user?.name || comment.user?.email || comment.userId || 'Neznámý autor';
}

export function PlaceDetailPanel({ planner, compact = false }: { planner: TripPlannerController; compact?: boolean }) {
  const { state, actions } = planner;
  const { openModal } = useModal();
  const place = state.selectedPlace;
  const [commentText, setCommentText] = useState('');

  if (!place) {
    return (
      <div className="p18 center muted t-sm" style={{ height: '100%' }}>
        Vyber pin nebo místo ze seznamu.
      </div>
    );
  }

  const currentPlace = place;
  const counts = voteCounts(place);
  const myVote = place.votes?.find((vote) => vote.userId === state.actorUserId)?.value;
  const hasCommentDraft = commentText.trim().length > 0;
  const members = state.selectedTrip?.members ?? [];
  const votedUserIds = new Set((place.votes ?? []).map((vote) => vote.userId));
  const missingVoters = members.filter((member) => !votedUserIds.has(member.userId));
  const status = normalizePlaceStatus(place.status);
  const statusMeta = placeStatusMeta[status];
  const canManagePlanning = canManageTrip(state.actorMember?.role);
  const canChangeStatus = canManagePlanning;
  const isShortlisted = status === 'SHORTLISTED';
  const statusActions: Array<{ status: PlaceStatus; label: string; tone: StatusTone }> = [
    { status: 'SHORTLISTED', label: 'Užší výběr', tone: 'amber' },
    { status: 'APPROVED', label: 'Schválit', tone: 'green' },
    { status: 'REJECTED', label: 'Zamítnout', tone: 'red' },
  ];
  const costLabel = formatPlaceCost(place.estimatedCost, state.selectedTrip?.currency);
  const mapUrl = externalMapUrl(place);

  function submitComment() {
    if (!hasCommentDraft) return;
    void actions.commentOnPlace(currentPlace.id, commentText).then(() => setCommentText(''));
  }

  return (
    <div className="col" style={{ height: '100%', minHeight: 0 }}>
      <div className="appbar">
        <button className="iconbtn plain" type="button" onClick={() => actions.setSelectedPlaceId('')} aria-label="Zpět na mapu">
          <ArrowLeft />
        </button>
        <span className="t-h3 flex1">Detail místa</span>
        <button className="iconbtn" type="button" onClick={() => openModal('addPlace', true)} aria-label="Upravit místo">
          <Pencil size={17} />
        </button>
      </div>

      <div className="scroll px18" style={{ flex: 1, paddingTop: 6 }}>
        <PlaceImage place={place} height={compact ? 168 : 188} />
        <div className="row between g8 mt16">
          <div className="row g8 wrap">
            <CategoryBadge type={place.type} />
            <PlaceScoreBadge place={place} />
          </div>
          <span className={`badge ${statusMeta.cls}`}>{statusMeta.label}</span>
        </div>
        <h2 className="t-title mt10">{place.name}</h2>
        <div className="row g10 mt8 muted t-sm wrap">
          <span className="row g4"><Clock size={14} />{place.durationMin ?? 90} min</span>
          <span className="row g4"><Banknote size={14} />{costLabel}</span>
          <span className="row g4"><MapPin size={14} />{place.locationLabel ?? state.selectedTrip?.destination ?? 'Destinace'}</span>
        </div>
        <p className="t-body mt14" style={{ color: '#3f3f46' }}>
          {place.description || 'Zatím bez popisu. Přidej poznámku k místu, aby skupina věděla, proč stojí za zvážení.'}
        </p>
        {(mapUrl || place.sourceUrl) && (
          <div className="row g8 mt12 wrap">
            {mapUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={mapUrl} target="_blank" rel="noreferrer"><MapPin />Mapa</a>
              </Button>
            )}
            {place.sourceUrl && (
              <Button asChild variant="ghost" size="sm">
                <a href={place.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink />Zdroj</a>
              </Button>
            )}
          </div>
        )}

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
          <div className="row g6 mt12 wrap">
            {statusActions.map((item) => {
              const Icon = item.status === 'SHORTLISTED' ? Bookmark : item.status === 'APPROVED' ? Check : X;
              return (
                <StatusActionButton
                  key={item.status}
                  active={status === item.status}
                  tone={item.tone}
                  size="sm"
                  type="button"
                  onClick={() => void actions.updatePlaceStatus(place.id, item.status)}
                >
                  <Icon />{item.label}
                </StatusActionButton>
              );
            })}
          </div>
        )}

        <hr className="sep mt20" />
        <div className="row between mt16 mb12"><span className="t-h3">Komentáře</span><span className="badge muted">{place.comments?.length ?? 0}</span></div>
        <div className="col g12">
          {(place.comments ?? []).length === 0 && <span className="muted t-sm">Zatím bez komentářů.</span>}
          {(place.comments ?? []).map((comment) => {
            const authorName = commentAuthorName(comment);
            return (
              <div className="row g10" style={{ alignItems: 'flex-start' }} key={comment.id ?? `${comment.userId}-${comment.body}`}>
                <Avatar size="sm" name={authorName} />
                <div className="col flex1" style={{ minWidth: 0 }}>
                  <div className="row g6">
                    <span className="semib t-sm">{authorName}</span>
                    {comment.createdAt && <span className="faint t-xs">{formatCommentTime(comment.createdAt)}</span>}
                  </div>
                  <span className="t-sm" style={{ color: '#3f3f46' }}>{comment.body}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="input muted-bg mt14" style={{ marginBottom: 8 }}>
          <MessageCircle />
          <input
            placeholder="Přidat komentář..."
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              submitComment();
            }}
          />
        </div>
      </div>
      {canManagePlanning && (
        <div className="row g8 p16" style={{ borderTop: '1px solid var(--border)', flex: '0 0 auto' }}>
          <Button className="flex1" type="button" onClick={() => void actions.addPlaceToItinerary(place.id)}>
            <CalendarPlus />Přidat do itineráře
          </Button>
          <StatusActionButton
            active={isShortlisted}
            tone="amber"
            variant="outline"
            size="icon"
            type="button"
            onClick={() => void actions.updatePlaceStatus(place.id, 'SHORTLISTED')}
            aria-label="Přidat do užšího výběru"
            title="Přidat do shortlistu"
          >
            <Bookmark />
          </StatusActionButton>
        </div>
      )}
    </div>
  );
}
