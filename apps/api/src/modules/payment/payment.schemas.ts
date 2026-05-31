import { z } from 'zod';

export const createPaymentAccountSchema = z.object({
  userId: z.string().min(1),
  label: z.string().default('Main'),
  iban: z.string().optional(),
  domesticAccount: z.string().optional(),
  bankCode: z.string().optional(),
  recipientName: z.string().optional(),
});
