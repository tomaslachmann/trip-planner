import * as React from 'react';
import { cn } from '@/lib/utils';

const Separator = React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  ({ className, ...props }, ref) => <hr ref={ref} className={cn('sep', className)} {...props} />,
);
Separator.displayName = 'Separator';

export { Separator };
