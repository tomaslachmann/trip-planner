import { z } from 'zod';

export const idSchema = z.string().min(1);
export const currencySchema = z.string().trim().length(3).transform((value) => value.toUpperCase());
export const actorUserIdSchema = z.object({ actorUserId: idSchema.optional() });

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

export function refineDateRange<T extends z.ZodTypeAny>(schema: T, startKey = 'startsAt', endKey = 'endsAt'): T {
  return schema.superRefine((value, ctx) => {
    const record = value as Record<string, unknown>;
    const startsAt = typeof record[startKey] === 'string' ? Date.parse(record[startKey]) : undefined;
    const endsAt = typeof record[endKey] === 'string' ? Date.parse(record[endKey]) : undefined;
    if (startsAt !== undefined && endsAt !== undefined && startsAt > endsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [endKey],
        message: `${endKey} must be after ${startKey}`,
      });
    }
  }) as T;
}
