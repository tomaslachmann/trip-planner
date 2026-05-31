# Product foundation

Users create a trip, invite friends, add suggested places on a shared map, vote/comment, shortlist accommodation, track shared expenses, and settle balances through QR payments.

## MVP

- Trips and members
- Member availability windows for people joining only part of a trip
- Map places with categories
- Votes and comments
- Itinerary days, selected stops, participants, and locking
- Route plans with route legs, distances, durations, and encoded polylines
- Accommodation search through a Booking-compatible provider with map pins and saved stay options
- Expenses and splits
- Expense split by all trip members or selected participants
- Settlement calculation
- SPD QR payment payloads
- Role checks for trip write operations
- Request validation for dates, money, coordinates, and trip ownership

## Place categories

- PLACE
- ACTIVITY
- DAY_TRIP
- STAY_AREA
- ACCOMMODATION
- FOOD
- TRANSPORT
- CUSTOM

## Planning model

- `TripMemberAvailability` stores each member's available `startsAt`/`endsAt` window, with optional join/leave places.
- `ItineraryDay` groups selected places into a concrete day plan and can be locked by an admin.
- `ItineraryStop` stores ordered places for a day and optional selected participants.
- `RoutePlan` stores generated routes for a trip.
- `RouteLeg` stores each hop between places with distance, duration, and `encodedPolyline`.
- `ACCOMMODATION` places represent saved stays from accommodation search providers.

## Accommodation providers

The backend exposes `/accommodations/search` and `/accommodations/save`.

- Local development uses RapidAPI Booking by default; missing credentials fail instead of returning fake hotels.
- The RapidAPI provider resolves destination IDs and searches live hotels through Booking COM endpoints.
- Search results are transient; saving a result creates a normal trip `Place` with type `ACCOMMODATION`.
