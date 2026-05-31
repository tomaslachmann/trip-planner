import { z } from 'zod';
import { actorUserIdSchema, currencySchema } from '../../utils/schemas.js';

export const updateSettlementStatusSchema = actorUserIdSchema.extend({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  amount: z.number().positive(),
  currency: currencySchema,
  status: z.enum(['OPEN', 'PAID', 'CONFIRMED', 'CANCELLED']),
  note: z.string().max(500).optional(),
});
