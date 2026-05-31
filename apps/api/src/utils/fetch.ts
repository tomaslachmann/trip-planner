import { env } from '../config/env.js';

export async function fetchWithTimeout(input: string | URL | Request, init: RequestInit = {}, timeoutMs = env.REQUEST_TIMEOUT_MS) {
  if (init.signal) return fetch(input, init);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = env.REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs} ms`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}
