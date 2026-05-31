import { z } from 'zod';

export const createExpenseSchema = z.object({
  tripId: z.string().min(1),
  paidById: z.string().min(1),
  title: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3).default('CZK'),
  splitUserIds: z.array(z.string().min(1)).min(1),
});
