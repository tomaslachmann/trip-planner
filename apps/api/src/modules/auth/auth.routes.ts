import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { jsonResponseSchema } from '../../utils/openapiSchemas.js';
import { httpError } from '../../utils/http.js';
import { createAccessToken, requireJwt } from './jwt.js';

const signInSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  name: z.string().min(1).optional(),
});

const updateMeSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().transform((email) => email.toLowerCase()).optional(),
  travelBudgetPreference: z.enum(['BUDGET', 'NORMAL', 'PREMIUM']).optional(),
  foodNotes: z.string().nullable().optional(),
  accessibilityNotes: z.string().nullable().optional(),
  defaultCurrency: z.enum(['CZK', 'EUR', 'USD', 'GBP']).optional(),
  paymentAccount: z.object({
    recipientName: z.string().nullable().optional(),
    iban: z.string().nullable().optional(),
    domesticAccount: z.string().nullable().optional(),
    bankCode: z.string().nullable().optional(),
  }).optional(),
});

const userInclude = { accounts: true } as const;

export async function authRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.post('/sign-in', {
    schema: {
      tags: ['auth'],
      summary: 'Sign in with email for development session',
      body: signInSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const body = signInSchema.parse(request.body);
    const user = await prisma.user.upsert({
      where: { email: body.email },
      create: { email: body.email, name: body.name ?? body.email.split('@')[0] ?? 'Cestovatel' },
      update: body.name ? { name: body.name } : {},
      include: userInclude,
    });
    return { user, accessToken: createAccessToken(user) };
  });

  routes.get('/me', {
    schema: {
      tags: ['auth'],
      summary: 'Get current session user',
      security: [{ bearerAuth: [] }],
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const jwt = requireJwt(request);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: jwt.sub }, include: userInclude });
    return { user };
  });

  routes.patch('/me', {
    schema: {
      tags: ['auth'],
      summary: 'Update current user settings',
      security: [{ bearerAuth: [] }],
      body: updateMeSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const jwt = requireJwt(request);
    const body = updateMeSchema.parse(request.body);
    const current = await prisma.user.findUniqueOrThrow({ where: { id: jwt.sub }, include: userInclude });

    if (body.email && body.email !== current.email) {
      const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
      if (existing && existing.id !== current.id) throw httpError(409, 'Email is already used by another account');
    }

    const user = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: current.id },
        data: {
          name: body.name,
          email: body.email,
          travelBudgetPreference: body.travelBudgetPreference,
          foodNotes: body.foodNotes,
          accessibilityNotes: body.accessibilityNotes,
          defaultCurrency: body.defaultCurrency,
        },
      });

      if (body.paymentAccount) {
        const account = current.accounts[0];
        const accountData = {
          label: 'Main',
          recipientName: body.paymentAccount.recipientName,
          iban: body.paymentAccount.iban,
          domesticAccount: body.paymentAccount.domesticAccount,
          bankCode: body.paymentAccount.bankCode,
        };
        if (account) {
          await tx.paymentAccount.update({ where: { id: account.id }, data: accountData });
        } else {
          await tx.paymentAccount.create({ data: { ...accountData, userId: current.id } });
        }
      }

      return tx.user.findUniqueOrThrow({ where: { id: current.id }, include: userInclude });
    });

    return { user };
  });

  routes.post('/sign-out', {
    schema: {
      tags: ['auth'],
      summary: 'Clear current session',
      security: [{ bearerAuth: [] }],
      response: { 200: z.object({ ok: z.boolean() }) },
    },
  }, async (request) => {
    requireJwt(request);
    return { ok: true };
  });
}
