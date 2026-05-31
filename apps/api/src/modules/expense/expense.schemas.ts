import { z } from 'zod';
import { actorUserIdSchema, currencySchema } from '../../utils/schemas.js';

export const createExpenseSchema = actorUserIdSchema.extend({
  tripId: z.string().min(1),
  paidById: z.string().min(1),
  title: z.string().min(1),
  category: z.string().trim().min(1).default('OTHER'),
  amount: z.number().positive(),
  currency: currencySchema.default('CZK'),
  originalAmount: z.number().positive().optional(),
  originalCurrency: currencySchema.optional(),
  exchangeRate: z.number().positive().optional(),
  exchangeDate: z.string().datetime().optional(),
  itineraryStopId: z.string().min(1).optional(),
  spentAt: z.string().datetime().optional(),
  receiptUrl: z.string().url().optional(),
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
  category: z.string().trim().min(1).optional(),
  paidById: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  currency: currencySchema.optional(),
  originalAmount: z.number().positive().nullable().optional(),
  originalCurrency: currencySchema.nullable().optional(),
  exchangeRate: z.number().positive().nullable().optional(),
  exchangeDate: z.string().datetime().nullable().optional(),
  itineraryStopId: z.string().min(1).nullable().optional(),
  spentAt: z.string().datetime().nullable().optional(),
  receiptUrl: z.string().url().nullable().optional(),
  splitType: z.enum(['EQUAL', 'CUSTOM']).optional(),
  splitAllTripMembers: z.boolean().optional(),
  splitUserIds: z.array(z.string().min(1)).min(1).optional(),
  customSplits: z.array(z.object({
    userId: z.string().min(1),
    amount: z.number().positive(),
  })).min(1).optional(),
}).superRefine((value, ctx) => {
  if (value.splitType === 'CUSTOM' && !value.customSplits?.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customSplits'], message: 'customSplits are required for CUSTOM split' });
  }
});

export const deleteExpenseSchema = actorUserIdSchema;
