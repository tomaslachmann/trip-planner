import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import Fastify from 'fastify';
import { registerApp } from '../src/plugins/app.js';

const outputPath = resolve('openapi.json');

const app = Fastify({ logger: false });
await registerApp(app);
await app.ready();

const spec = app.swagger();
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(spec, null, 2)}\n`);
await app.close();

console.log(`Generated ${outputPath}`);
