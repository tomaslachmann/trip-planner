'use client';

import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DockSnap = 'peek' | 'half' | 'full';

const heights: Record<DockSnap, number> = { peek: 0.18, half: 0.52, full: 0.9 };

export function DockedSheet({
  snap,
  onSnapChange,
  children,
  className,
}: {
  snap: DockSnap;
  onSnapChange: (snap: DockSnap) => void;
  children: ReactNode;
  className?: string;
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ y: number; height: number; viewport: number } | null>(null);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!sheetRef.current) return;
    const viewport = sheetRef.current.parentElement?.clientHeight ?? window.innerHeight;
    dragRef.current = { y: event.clientY, height: sheetRef.current.offsetHeight, viewport };
    sheetRef.current.style.transition = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  function move(event: PointerEvent) {
    if (!dragRef.current || !sheetRef.current) return;
    const deltaY = dragRef.current.y - event.clientY;
    const nextHeight = Math.max(78, Math.min(dragRef.current.viewport * 0.92, dragRef.current.height + deltaY));
    sheetRef.current.style.height = `${nextHeight}px`;
  }

  function stop() {
    if (!dragRef.current || !sheetRef.current) return;
    const fraction = sheetRef.current.offsetHeight / dragRef.current.viewport;
    const nearest = (Object.entries(heights) as Array<[DockSnap, number]>)
      .sort((a, b) => Math.abs(a[1] - fraction) - Math.abs(b[1] - fraction))[0][0];
    sheetRef.current.style.transition = '';
    sheetRef.current.style.height = '';
    dragRef.current = null;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', stop);
    onSnapChange(nearest);
  }

  return (
    <div ref={sheetRef} className={cn('docksheet', className)} style={{ height: `${heights[snap] * 100}%` }}>
      <div onPointerDown={startDrag} style={{ cursor: 'grab', flex: '0 0 auto', touchAction: 'none' }}>
        <div className="grabber" />
      </div>
      {children}
    </div>
  );
}

export const dockSnapHeights = heights;
