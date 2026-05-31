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
  return <Button className={cn('btn', tone, tripSize, block && 'block', className)} {...props} />;
}

export function TripChromeButton({ className, ...props }: ButtonProps) {
  return <Button variant="ghost" className={cn(className)} {...props} />;
}

export function TripIconButton({ className, plain, ...props }: ButtonProps & { plain?: boolean }) {
  return <Button className={cn('iconbtn', plain && 'plain', className)} {...props} />;
}

export function TripCard({ className, pad, shadow = true, ...props }: ComponentProps<typeof Card> & { pad?: boolean; shadow?: boolean }) {
  return <Card className={cn('card', pad && 'pad', shadow && 'sh', className)} {...props} />;
}

export function TripBadge({ className, ...props }: ComponentProps<typeof Badge>) {
  return <Badge className={cn('badge', className)} {...props} />;
}
