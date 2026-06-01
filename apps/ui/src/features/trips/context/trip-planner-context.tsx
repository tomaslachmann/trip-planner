'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { TripPlannerController } from '../hooks/use-trip-planner';

const TripPlannerContext = createContext<TripPlannerController | null>(null);
const TripViewportContext = createContext<{ isDesktop: boolean }>({ isDesktop: false });

export function TripPlannerProvider({
  planner,
  isDesktop,
  children,
}: {
  planner: TripPlannerController;
  isDesktop: boolean;
  children: ReactNode;
}) {
  return (
    <TripPlannerContext.Provider value={planner}>
      <TripViewportContext.Provider value={{ isDesktop }}>{children}</TripViewportContext.Provider>
    </TripPlannerContext.Provider>
  );
}

export function useTripPlannerContext() {
  const planner = useContext(TripPlannerContext);
  if (!planner) throw new Error('useTripPlannerContext must be used inside TripPlannerProvider');
  return planner;
}

export function useTripViewport() {
  return useContext(TripViewportContext);
}
