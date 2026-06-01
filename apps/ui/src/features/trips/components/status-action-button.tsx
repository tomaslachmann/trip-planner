import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type StatusTone = 'amber' | 'green' | 'red' | 'muted';

const activeToneClass: Record<StatusTone, string> = {
  amber: '!border-[#fde68a] !bg-[#fffbeb] !text-[#b45309] hover:!bg-[#fef3c7] hover:!text-[#92400e]',
  green: '!border-[#bbf7d0] !bg-[#f0fdf4] !text-[#15803d] hover:!bg-[#dcfce7] hover:!text-[#166534]',
  red: '!border-[#fecdd3] !bg-[#fff1f2] !text-[#be123c] hover:!bg-[#ffe4e6] hover:!text-[#9f1239]',
  muted: '!border-transparent !bg-muted !text-muted-foreground hover:!bg-muted/80',
};

export function statusActionClass(tone: StatusTone, active: boolean) {
  return active ? activeToneClass[tone] : '';
}

export function StatusActionButton({
  active,
  tone,
  className,
  variant = 'outline',
  ...props
}: ButtonProps & { active: boolean; tone: StatusTone }) {
  return (
    <Button
      variant={variant}
      className={cn(statusActionClass(tone, active), className)}
      data-active={active ? 'true' : undefined}
      {...props}
    />
  );
}
