'use client';

import { BedDouble, Bookmark, Check, ExternalLink, MapPin, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import { accommodationStatusMeta, getAccommodationSummary } from '../lib/accommodation-scoring';
import { bookingDetailUrl } from '../lib/booking-links';
import { externalMapUrl } from '../lib/map-links';
import { AccommodationPhoto, AccommodationRatingBadge, accommodationPriceLabel, accommodationTypeLabel } from './accommodation-display';
import { StatusActionButton } from './status-action-button';

export function AccommodationDetailPanel({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const stay = state.selectedAccommodation;

  if (!stay) {
    return (
      <div className="p18 center muted t-sm" style={{ height: '100%' }}>
        Vyber ubytování z mapy nebo výsledků hledání.
      </div>
    );
  }

  const currentStay = stay;
  const savedPlace = state.data.places.find((place) => place.type === 'ACCOMMODATION' && place.accommodationExternalId === currentStay.externalId);
  const displayStay = { ...currentStay, photoUrl: currentStay.photoUrl ?? savedPlace?.imageUrl ?? undefined };
  const members = state.selectedTrip?.members ?? [];
  const summary = savedPlace ? getAccommodationSummary(savedPlace, members, state.actorUserId) : null;
  const status = summary?.status ?? 'SAVED';
  const stats = summary?.stats;
  const statusMeta = accommodationStatusMeta[status];
  const mapUrl = externalMapUrl(currentStay);
  const bookingUrl = bookingDetailUrl(currentStay, state.selectedTrip);

  function saveOrShortlist() {
    if (!savedPlace) {
      void actions.saveAccommodation(currentStay);
      return;
    }
    void actions.voteForPlace(savedPlace.id, 'UP');
  }

  return (
    <div className="col" style={{ height: '100%', minHeight: 0 }}>
      <div className="appbar">
        <span className="t-h3 flex1">Detail ubytování</span>
        <button className="iconbtn plain" type="button" onClick={() => actions.setSelectedAccommodationId('')} aria-label="Zavřít detail">
          <X size={18} />
        </button>
      </div>

      <div className="scroll px18" style={{ flex: 1, paddingTop: 6, paddingBottom: 18 }}>
        <AccommodationPhoto stay={displayStay} size={220} style={{ width: '100%', height: 178, borderRadius: 14 }} />

        <div className="row between g8 mt16">
          <span className="badge cat-stay"><BedDouble />{accommodationTypeLabel(currentStay)}</span>
          <AccommodationRatingBadge reviewScore={currentStay.reviewScore} rating={currentStay.rating} reviewCount={currentStay.reviewCount} />
        </div>

        <h2 className="t-title mt10">{currentStay.name}</h2>
        <div className="row g8 mt8 wrap">
          <span className={`badge ${statusMeta.cls}`}>{statusMeta.label}</span>
          <span className="badge muted tnum">{accommodationPriceLabel(currentStay)}</span>
        </div>

        <div className="row g8 mt14 wrap">
          {mapUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={mapUrl} target="_blank" rel="noreferrer"><MapPin />Mapa</a>
            </Button>
          )}
          {bookingUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={bookingUrl} target="_blank" rel="noreferrer"><ExternalLink />Booking</a>
            </Button>
          )}
        </div>

        <Separator className="my-5" />

        {savedPlace && stats ? (
          <>
            <div className="row between mb10">
              <span className="t-h3">Rozhodnutí skupiny</span>
              <span className="muted t-xs">{stats.totalVotes}/{members.length || '?'} hlasovalo</span>
            </div>
            <div className="row g8 wrap">
              <span className="badge solid"><Check size={12} />{stats.selected} vybráno</span>
              <span className="badge"><ThumbsUp size={12} />{stats.shortlist} užší výběr</span>
              <span className="badge red"><ThumbsDown size={12} />{stats.against} proti</span>
            </div>
            {stats.missingVoters.length > 0 && (
              <div className="badge muted mt10" style={{ maxWidth: '100%', justifyContent: 'flex-start' }}>
                Čeká: {stats.missingVoters.map((member) => member.user.name).join(', ')}
              </div>
            )}
          </>
        ) : (
          <p className="muted t-sm">
            Tohle ubytování je zatím jen výsledek hledání. Ulož ho jako kandidáta, aby se k němu dalo hlasovat a pracovat s ním v rozhodování.
          </p>
        )}
      </div>

      <div className="row g8 p16 wrap" style={{ borderTop: '1px solid var(--border)', flex: '0 0 auto' }}>
        <StatusActionButton className="flex1" active={stats?.myVote === 'UP' || status === 'SHORTLISTED'} tone="amber" type="button" variant={savedPlace ? 'outline' : 'default'} onClick={saveOrShortlist}>
          <Bookmark />{savedPlace ? 'Užší výběr' : 'Uložit ubytování'}
        </StatusActionButton>
        {savedPlace && (
          <>
            <StatusActionButton active={status === 'SELECTED' || status === 'BOOKED'} tone="green" type="button" onClick={() => void actions.updateAccommodationStatus(savedPlace.id, 'SELECTED')}>
              <Check />Vybrat
            </StatusActionButton>
            <StatusActionButton active={stats?.myVote === 'DOWN' || status === 'REJECTED'} tone="red" variant="ghost" type="button" onClick={() => void actions.voteForPlace(savedPlace.id, 'DOWN')} aria-label="Proti">
              <ThumbsDown />
            </StatusActionButton>
          </>
        )}
      </div>
    </div>
  );
}
