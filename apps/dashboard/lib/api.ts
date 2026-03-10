import { getStoredSession } from './auth';

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  token?: string,
) {
  const session = getStoredSession();
  const authToken = token ?? session?.accessToken;
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}
