import { Button, type ButtonProps } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

type TripButtonTone = 'primary' | 'outline' | 'ghost' | 'secondary' | 'destructive';
type TripButtonSize = 'sm' | 'lg' | 'icon';

export function TripButton({
  className,
  tone,
  tripSize,
  block,
  ...props
}: ButtonProps & { tone?: TripButtonTone; tripSize?: TripButtonSize; block?: boolean }) {
  const variant = tone === 'primary' ? 'default' : tone;
  const size = tripSize === 'lg' ? 'lg' : tripSize === 'sm' ? 'sm' : tripSize === 'icon' ? 'icon' : undefined;
  return <Button variant={variant} size={size} className={cn(block && 'w-full', className)} {...props} />;
}

export function TripChromeButton({ className, ...props }: ButtonProps) {
  return <Button variant="ghost" className={cn(className)} {...props} />;
}

export function TripIconButton({ className, plain, ...props }: ButtonProps & { plain?: boolean }) {
  return (
    <Button
      variant={plain ? 'ghost' : 'outline'}
      size="icon"
      className={cn('rounded-[11px] h-[38px] w-[38px] [&_svg]:size-[19px]', className)}
      {...props}
    />
  );
}

export function TripCard({ className, pad, shadow = true, ...props }: ComponentProps<typeof Card> & { pad?: boolean; shadow?: boolean }) {
  return (
    <Card
      className={cn(pad && 'p-[14px]', shadow && 'shadow-[var(--sh-sm)]', className)}
      {...props}
    />
  );
}

export function TripBadge({ className, ...props }: ComponentProps<typeof Badge>) {
  return <Badge className={cn(className)} {...props} />;
}
