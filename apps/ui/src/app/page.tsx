import { Suspense } from 'react';
import { TripPlannerPage } from '@/features/trips/trip-planner-page';

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <TripPlannerPage />
    </Suspense>
  );
}
