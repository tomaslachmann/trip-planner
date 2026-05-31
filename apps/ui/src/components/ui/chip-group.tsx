'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ChipOption<T extends string> = {
  value: T;
  label: ReactNode;
};

export function ChipGroup<T extends string>({
  value,
  options,
  onValueChange,
  className,
}: {
  value: T;
  options: Array<ChipOption<T>>;
  onValueChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('chips', className)} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          className={cn('chip', value === option.value && 'on')}
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

export function ChipButton({
  selected,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
}) {
  return (
    <button
      className={cn('chip', selected && 'on', className)}
      type="button"
      aria-pressed={selected}
      {...props}
    >
      {children}
    </button>
  );
}

export function MultiChipGroup<T extends string>({
  values,
  options,
  onValuesChange,
  className,
}: {
  values: T[];
  options: Array<ChipOption<T>>;
  onValuesChange: (values: T[]) => void;
  className?: string;
}) {
  const selected = new Set(values);
  return (
    <div className={cn('chips', className)} role="group">
      {options.map((option) => (
        <ChipButton
          key={option.value}
          selected={selected.has(option.value)}
          onClick={() => {
            if (selected.has(option.value)) onValuesChange(values.filter((value) => value !== option.value));
            else onValuesChange([...values, option.value]);
          }}
        >
          {option.label}
        </ChipButton>
      ))}
    </div>
  );
}
