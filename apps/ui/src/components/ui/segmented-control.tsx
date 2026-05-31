'use client';

import { cn } from '@/lib/utils';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  className,
}: {
  value: T;
  options: Array<SegmentedOption<T>>;
  onValueChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('seg', className)} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          className={value === option.value ? 'on' : undefined}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onValueChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
