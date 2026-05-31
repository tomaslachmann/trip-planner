import { z } from 'zod';

export const emptyResponseSchema = z.null().describe('No response body');
export const jsonResponseSchema = z.unknown().describe('JSON response');
export const dateTimeResponseSchema = z.union([z.string().datetime(), z.date()]);
export const nullableDateTimeResponseSchema = dateTimeResponseSchema.nullable();

export const idParamSchema = z.object({ id: z.string().min(1) });
export const tripIdParamSchema = z.object({ tripId: z.string().min(1) });
export const memberIdParamSchema = z.object({ memberId: z.string().min(1) });
export const tripMemberIdParamSchema = z.object({ tripMemberId: z.string().min(1) });
export const availabilityIdParamSchema = z.object({ availabilityId: z.string().min(1) });
export const dayIdParamSchema = z.object({ dayId: z.string().min(1) });
export const stopIdParamSchema = z.object({ stopId: z.string().min(1) });
export const routePlanIdParamSchema = z.object({ routePlanId: z.string().min(1) });

export const actorQuerySchema = z.object({ actorUserId: z.string().min(1).optional() });
