'use client';

import { MoreScreen } from '@/features/trips/components/more-screen';
import { useTripPlannerContext, useTripViewport } from '@/features/trips/context/trip-planner-context';

export default function TripMorePage() {
  const planner = useTripPlannerContext();
  const { isDesktop } = useTripViewport();
  return <MoreScreen planner={planner} desktop={isDesktop} />;
}
