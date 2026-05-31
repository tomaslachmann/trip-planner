'use client';

import { useState } from 'react';
import { AddMenu } from './add-menu';
import { BottomNav } from './bottom-nav';
import { MapScreen } from './map-screen';
import { MoreScreen } from './more-screen';
import { PlanScreen } from './plan-screen';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import type { TabKey } from '../types';

export function MobileTripApp({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const [addOpen, setAddOpen] = useState(false);

  function pickAdd(target: 'place' | 'stay' | 'expense') {
    setAddOpen(false);
    if (target === 'place') actions.setActiveTab('plan');
    if (target === 'stay') actions.setActiveTab('stay');
    if (target === 'expense') actions.setActiveTab('costs');
  }

  const active = state.activeTab === 'settle' ? 'costs' : state.activeTab;
  let content = <MapScreen planner={planner} />;
  if (active === 'plan' || active === 'stay') content = <PlanScreen planner={planner} forcedTab={active === 'stay' ? 'stay' : undefined} />;
  if (active === 'costs') content = <PlanScreen planner={planner} forcedTab="costs" mobile />;
  if (active === 'members') content = <PlanScreen planner={planner} forcedTab="members" />;
  if (active === 'more') content = <MoreScreen planner={planner} />;

  return (
    <div className="mobile-stage">
      <div className="mobile-app-shell">
        <div className="viewport">
          {content}
        </div>
        <BottomNav active={active as TabKey} tripHref={actions.tripHref} onNav={actions.setActiveTab} onAdd={() => setAddOpen(true)} />
        {state.message && <div className="badge red" style={{ position: 'absolute', left: 18, right: 18, bottom: 88, zIndex: 70, justifyContent: 'center' }}>{state.message}</div>}
        {addOpen && <AddMenu onClose={() => setAddOpen(false)} onPick={pickAdd} />}
      </div>
    </div>
  );
}
