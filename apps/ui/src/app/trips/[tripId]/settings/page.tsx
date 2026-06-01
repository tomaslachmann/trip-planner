'use client';

import { UserSettingsContent } from '@/features/user-settings/user-settings-page';
import { useTripViewport } from '@/features/trips/context/trip-planner-context';

export default function TripUserSettingsPage() {
  const { isDesktop } = useTripViewport();

  if (isDesktop) {
    return (
      <div className="desk-body">
        <div className="desk-scroll">
          <div className="maxw" style={{ maxWidth: 680 }}>
            <h1 className="desk-h mb16">Tvoje nastavení</h1>
            <UserSettingsContent />
          </div>
        </div>
      </div>
    );
  }

  return <UserSettingsContent mobileAppBar />;
}
