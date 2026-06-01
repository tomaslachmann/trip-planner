import createClient from 'openapi-fetch';
import type { paths } from '@/generated/openapi-types';

const fallbackApiUrl = 'http://localhost:3001';
const tokenStorageKey = 'trip-planner-access-token';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  travelBudgetPreference?: 'BUDGET' | 'NORMAL' | 'PREMIUM';
  foodNotes?: string | null;
  accessibilityNotes?: string | null;
  defaultCurrency?: string;
  accounts?: Array<{
    id?: string;
    label?: string;
    iban?: string | null;
    domesticAccount?: string | null;
    bankCode?: string | null;
    recipientName?: string | null;
  }>;
};

export type UpdateSessionUserRequest = {
  name?: string;
  email?: string;
  travelBudgetPreference?: 'BUDGET' | 'NORMAL' | 'PREMIUM';
  foodNotes?: string | null;
  accessibilityNotes?: string | null;
  defaultCurrency?: 'CZK' | 'EUR' | 'USD' | 'GBP';
  paymentAccount?: {
    recipientName?: string | null;
    iban?: string | null;
    domesticAccount?: string | null;
    bankCode?: string | null;
  };
};

export type SignInResponse = {
  user: SessionUser;
  accessToken: string;
};

export type AuthCredentials = {
  email: string;
  password: string;
};

export type RegisterCredentials = AuthCredentials & {
  name: string;
};

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? fallbackApiUrl;
}

export function readAccessToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(tokenStorageKey) ?? '';
}

export function writeAccessToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(tokenStorageKey, token);
}

export function clearAccessToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(tokenStorageKey);
}

export function createTripPlannerClient(accessToken?: string) {
  const token = accessToken ?? readAccessToken();
  return createClient<paths>({
    baseUrl: getApiBaseUrl(),
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, accessToken?: string): Promise<T> {
  const token = accessToken ?? readAccessToken();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function registerRequest(body: RegisterCredentials) {
  return apiFetch<SignInResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }, '');
}

export function signInRequest(body: AuthCredentials) {
  return apiFetch<SignInResponse>('/auth/sign-in', { method: 'POST', body: JSON.stringify(body) }, '');
}

export function getSessionUser(accessToken?: string) {
  return apiFetch<{ user: SessionUser }>('/auth/me', { method: 'GET' }, accessToken);
}

export function updateSessionUser(body: UpdateSessionUserRequest, accessToken?: string) {
  return apiFetch<{ user: SessionUser }>('/auth/me', { method: 'PATCH', body: JSON.stringify(body) }, accessToken);
}

export function signOutRequest(accessToken?: string) {
  return apiFetch<{ ok: boolean }>('/auth/sign-out', { method: 'POST' }, accessToken);
}

export type TripPlannerClient = ReturnType<typeof createTripPlannerClient>;
