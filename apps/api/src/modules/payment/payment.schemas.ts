import { z } from 'zod';
import { actorUserIdSchema } from '../../utils/schemas.js';

export const createPaymentAccountSchema = actorUserIdSchema.extend({
  userId: z.string().min(1),
  label: z.string().default('Main'),
  iban: z.string().optional(),
  domesticAccount: z.string().optional(),
  bankCode: z.string().optional(),
  recipientName: z.string().optional(),
});
