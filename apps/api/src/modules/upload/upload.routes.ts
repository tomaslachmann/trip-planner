import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { getActorUserId, requireTripMember } from '../access/access.js';
import { httpError } from '../../utils/http.js';

const maxReceiptSize = 8 * 1024 * 1024;

const uploadReceiptSchema = z.object({
  tripId: z.string().min(1),
  fileName: z.string().min(1).max(180),
  contentType: z.string().min(1).max(120).optional(),
  dataUrl: z.string().min(1).max(12 * 1024 * 1024),
  actorUserId: z.string().optional(),
});

const uploadReceiptResponseSchema = z.object({
  url: z.string().url(),
  fileName: z.string(),
  contentType: z.string(),
  size: z.number().int().nonnegative(),
});

const allowedContentTypes = new Set([
  'application/pdf',
  'image/heic',
  'image/heif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const extensionByContentType: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function uploadRoot() {
  return path.resolve(process.cwd(), env.UPLOAD_DIR);
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) throw httpError(400, 'Invalid file payload');
  return {
    contentType: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function requestBaseUrl(request: FastifyRequest) {
  if (env.PUBLIC_API_URL) return env.PUBLIC_API_URL.replace(/\/$/, '');
  const forwardedProto = request.headers['x-forwarded-proto'];
  const forwardedHost = request.headers['x-forwarded-host'];
  const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ?? request.protocol ?? 'http';
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ?? request.headers.host ?? `localhost:${env.PORT}`;
  return `${proto}://${host}`;
}

function contentTypeFromFileName(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.heic') return 'image/heic';
  if (ext === '.heif') return 'image/heif';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return undefined;
}

export async function uploadRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.post('/receipts', {
    schema: {
      tags: ['uploads'],
      summary: 'Upload expense receipt',
      security: [{ bearerAuth: [] }],
      body: uploadReceiptSchema,
      response: { 201: uploadReceiptResponseSchema },
    },
  }, async (request, reply) => {
    const body = uploadReceiptSchema.parse(request.body);
    const actorUserId = getActorUserId(request, body);
    await requireTripMember(body.tripId, actorUserId);

    const parsed = parseDataUrl(body.dataUrl);
    const contentType = parsed.contentType || body.contentType?.toLowerCase() || contentTypeFromFileName(body.fileName);
    if (!contentType || !allowedContentTypes.has(contentType)) throw httpError(415, 'Unsupported receipt file type');
    if (parsed.buffer.length > maxReceiptSize) throw httpError(413, 'Receipt file is too large');

    const ext = extensionByContentType[contentType];
    const fileName = `${randomUUID()}.${ext}`;
    const relativePath = path.join('receipts', body.tripId, fileName);
    const fullPath = path.join(uploadRoot(), relativePath);

    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, parsed.buffer, { flag: 'wx' });

    return reply.code(201).send({
      url: `${requestBaseUrl(request)}/uploads/receipts/${encodeURIComponent(body.tripId)}/${encodeURIComponent(fileName)}`,
      fileName,
      contentType,
      size: parsed.buffer.length,
    });
  });

  routes.get('/receipts/:tripId/:fileName', {
    schema: {
      tags: ['uploads'],
      summary: 'Get expense receipt file',
      params: z.object({ tripId: z.string(), fileName: z.string() }),
    },
  }, async (request, reply) => {
    const { tripId, fileName } = request.params as { tripId: string; fileName: string };
    if (fileName !== path.basename(fileName)) throw httpError(400, 'Invalid file name');

    const fullPath = path.join(uploadRoot(), 'receipts', tripId, fileName);
    try {
      await stat(fullPath);
    } catch {
      throw httpError(404, 'Receipt not found');
    }

    reply
      .type(contentTypeFromFileName(fileName) ?? 'application/octet-stream')
      .header('cache-control', 'private, max-age=31536000, immutable');
    return reply.send(createReadStream(fullPath));
  });
}
