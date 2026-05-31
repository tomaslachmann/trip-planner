import { Suspense, type ReactNode } from 'react';

export default function TripLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
