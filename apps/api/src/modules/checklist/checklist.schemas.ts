import { z } from 'zod';
import { actorUserIdSchema } from '../../utils/schemas.js';

export const createChecklistItemSchema = actorUserIdSchema.extend({
  tripId: z.string().min(1),
  title: z.string().min(1),
  note: z.string().optional(),
  scope: z.enum(['PERSONAL', 'SHARED', 'EVERYONE']).default('SHARED'),
  dueAt: z.string().datetime().optional(),
  assignedUserIds: z.array(z.string().min(1)).optional(),
});

export const updateChecklistItemSchema = actorUserIdSchema.extend({
  title: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
  scope: z.enum(['PERSONAL', 'SHARED', 'EVERYONE']).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  assignedUserIds: z.array(z.string().min(1)).optional(),
});

export const completeChecklistItemSchema = actorUserIdSchema.extend({
  completed: z.boolean(),
});

export const deleteChecklistItemSchema = actorUserIdSchema;
