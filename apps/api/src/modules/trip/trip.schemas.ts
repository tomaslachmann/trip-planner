import { z } from 'zod';

export const createTripSchema = z.object({
  name: z.string().min(1),
  destination: z.string().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  currency: z.string().length(3).default('CZK'),
  owner: z.object({ email: z.string().email(), name: z.string().min(1) }),
});

export const joinTripSchema = z.object({
  inviteCode: z.string().min(1),
  user: z.object({ email: z.string().email(), name: z.string().min(1) }),
});
