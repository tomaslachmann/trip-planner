import { z } from 'zod';
import { actorUserIdSchema, currencySchema } from '../../utils/schemas.js';

export const createExpenseSchema = actorUserIdSchema.extend({
  tripId: z.string().min(1),
  paidById: z.string().min(1),
  title: z.string().min(1),
  amount: z.number().positive(),
  currency: currencySchema.default('CZK'),
  itineraryStopId: z.string().min(1).optional(),
  splitType: z.enum(['EQUAL', 'CUSTOM']).default('EQUAL'),
  splitAllTripMembers: z.boolean().default(false),
  splitUserIds: z.array(z.string().min(1)).min(1).optional(),
  customSplits: z.array(z.object({
    userId: z.string().min(1),
    amount: z.number().positive(),
  })).min(1).optional(),
}).superRefine((value, ctx) => {
  if (value.splitType === 'CUSTOM') {
    if (!value.customSplits?.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customSplits'], message: 'customSplits are required for CUSTOM split' });
    }
    return;
  }

  if (!value.splitAllTripMembers && !value.splitUserIds?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['splitUserIds'],
      message: 'Select splitUserIds or set splitAllTripMembers=true',
    });
  }
});

export const updateExpenseSchema = actorUserIdSchema.extend({
  title: z.string().min(1).optional(),
});

export const deleteExpenseSchema = actorUserIdSchema;
