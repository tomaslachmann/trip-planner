import Fastify from 'fastify';
import { env } from './config/env.js';
import { registerApp } from './plugins/app.js';

const app = Fastify({ logger: true });
await registerApp(app);

await app.listen({ port: env.PORT, host: '0.0.0.0' });
