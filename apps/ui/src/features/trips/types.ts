export type TabKey = 'map' | 'plan' | 'stay' | 'costs' | 'settle' | 'members' | 'more';

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

export type Place = {
  id: string;
  tripId: string;
  type: string;
  name: string;
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
  comments?: Array<{ id?: string; userId?: string; body?: string; createdAt?: string }>;
};

export type ItineraryStop = {
  id: string;
  order: number;
  placeId?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  place?: { id?: string; name: string; type: string };
};

export type ItineraryDay = {
  id: string;
  date: string;
  title?: string | null;
  locked: boolean;
  stops?: ItineraryStop[];
};

export type Expense = {
  id: string;
  title: string;
  amount: string | number;
  currency: string;
  splitType: string;
  splits?: unknown[];
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
  qrPayload?: string;
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

export type TripData = {
  places: Place[];
  itinerary: ItineraryDay[];
  expenses: Expense[];
  routes: RoutePlan[];
  settlements: Settlement[];
};
