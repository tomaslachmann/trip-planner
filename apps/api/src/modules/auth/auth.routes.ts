import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { jsonResponseSchema } from '../../utils/openapiSchemas.js';
import { createAccessToken, requireJwt } from './jwt.js';

const signInSchema = z.object({
  email: z.string().email().transform((email) => email.toLowerCase()),
  name: z.string().min(1).optional(),
});

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
    const user = await prisma.user.findUniqueOrThrow({ where: { id: jwt.sub } });
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
