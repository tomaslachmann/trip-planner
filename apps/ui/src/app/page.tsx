import { Suspense } from 'react';
import { TripIndexPage } from '@/features/trips/trip-index-page';

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <TripIndexPage />
    </Suspense>
  );
}
