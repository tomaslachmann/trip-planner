export type TabKey = 'map' | 'plan' | 'stay' | 'costs' | 'settle' | 'members' | 'more' | 'checklist' | 'polls' | 'itinerary';

export type TripMember = {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string; email: string };
  availabilityWindows?: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    note?: string | null;
    startPlace?: { id: string; name: string } | null;
    endPlace?: { id: string; name: string } | null;
  }>;
};

export type Trip = {
  id: string;
  name: string;
  destination?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  currency: string;
  inviteCode: string;
  members?: TripMember[];
};

export type PlaceType = 'PLACE' | 'ACTIVITY' | 'DAY_TRIP' | 'STAY_AREA' | 'ACCOMMODATION' | 'FOOD' | 'TRANSPORT' | 'CUSTOM';

export type Place = {
  id: string;
  tripId: string;
  type: PlaceType | string;
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  durationMin?: number | null;
  estimatedCost?: string | number | null;
  sourceUrl?: string | null;
  accommodationProvider?: string | null;
  accommodationExternalId?: string | null;
  accommodationRating?: number | null;
  accommodationReviewScore?: number | null;
  accommodationReviewCount?: number | null;
  accommodationCurrency?: string | null;
  accommodationDeepLinkUrl?: string | null;
  accommodationStatus?: string | null;
  votes?: Array<{ userId?: string; value: string }>;
  dayVotes?: Array<{ itineraryDayId?: string; userId?: string; value: string }>;
  comments?: Array<{ id?: string; userId?: string; body?: string; createdAt?: string }>;
};

export type ItineraryStop = {
  id: string;
  order: number;
  placeId?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  note?: string | null;
  place?: { id?: string; name: string; type: string };
  participants?: Array<{ tripMemberId: string; member?: TripMember }>;
};

export type ItineraryDay = {
  id: string;
  date: string;
  title?: string | null;
  basePlaceId?: string | null;
  basePlace?: { id: string; name: string; type?: string } | null;
  intensity?: 'CALM' | 'NORMAL' | 'INTENSE' | string;
  rainPlan?: string | null;
  bufferMinutes?: number | null;
  locked: boolean;
  stops?: ItineraryStop[];
  placeVotes?: Array<{ placeId?: string; userId?: string; value: string }>;
};

export type Expense = {
  id: string;
  paidById?: string;
  title: string;
  amount: string | number;
  currency: string;
  originalAmount?: string | number | null;
  originalCurrency?: string | null;
  exchangeRate?: string | number | null;
  exchangeDate?: string | null;
  splitType: string;
  splits?: Array<{ userId: string; amount?: string | number }>;
  paidBy?: { id: string; name: string; email: string };
};

export type RoutePlan = {
  id: string;
  name: string;
  mode: string;
  locked: boolean;
  legs?: Array<{
    distanceMeters?: number | null;
    durationSeconds?: number | null;
    encodedPolyline?: string | null;
    provider?: string | null;
  }>;
};

export type Settlement = {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  status?: 'OPEN' | 'PAID' | 'CONFIRMED' | 'CANCELLED';
  paidAt?: string | null;
  confirmedAt?: string | null;
  qrPayload?: string;
};

export type ActivityEvent = {
  id: string;
  tripId: string;
  actorUserId?: string | null;
  type: string;
  entityType?: string | null;
  entityId?: string | null;
  label: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor?: { id: string; name: string; email: string } | null;
};

export type Accommodation = {
  provider: 'booking';
  externalId: string;
  name: string;
  type?: string;
  latitude: number;
  longitude: number;
  priceTotal?: number;
  priceDisplay?: string;
  currency?: string;
  rating?: number;
  reviewScore?: number;
  reviewCount?: number;
  sourceUrl?: string;
  deepLinkUrl?: string;
};

export type LocationResult = {
  provider: 'nominatim';
  externalId: string;
  label: string;
  latitude: number;
  longitude: number;
  type?: string;
  countryCode?: string;
};

export type Poll = {
  id: string;
  tripId: string;
  question: string;
  status: 'OPEN' | 'CLOSED';
  multiChoice: boolean;
  contextDayId?: string | null;
  contextPlaceId?: string | null;
  options?: Array<{
    id: string;
    title: string;
    order: number;
    placeId?: string | null;
    itineraryDayId?: string | null;
    votes?: Array<{ userId: string; user?: { id: string; name: string } }>;
  }>;
};

export type ChecklistItem = {
  id: string;
  tripId: string;
  title: string;
  note?: string | null;
  scope: 'PERSONAL' | 'SHARED' | 'EVERYONE';
  dueAt?: string | null;
  assignments?: Array<{ userId: string; user?: { id: string; name: string } }>;
  completions?: Array<{ userId: string; completedAt: string; user?: { id: string; name: string } }>;
};

export type TripData = {
  places: Place[];
  itinerary: ItineraryDay[];
  expenses: Expense[];
  routes: RoutePlan[];
  settlements: Settlement[];
  polls: Poll[];
  checklist: ChecklistItem[];
  activity: ActivityEvent[];
};
