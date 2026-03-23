/**
 * Admin API client with auth
 */

import { buildApiUrl } from './env';

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem('admin_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const method = opts?.method ?? 'GET';
  const hasBody = opts?.body !== undefined && opts?.body !== null;
  const body = hasBody ? opts!.body : (method !== 'GET' && method !== 'HEAD' ? '{}' : undefined);
  const res = await fetch(buildApiUrl(path), {
    ...opts,
    body,
    headers: {
      ...getAuthHeaders(),
      ...(opts?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || `HTTP ${res.status}`);
  }
  return data as T;
}

export function artifactUrl(runId: string, index: number): string {
  return `${buildApiUrl('/admin/artifacts/serve')}?runId=${encodeURIComponent(runId)}&index=${index}`;
}

export function artifactByIdUrl(id: string): string {
  return buildApiUrl(`/admin/artifacts/${encodeURIComponent(id)}/serve`);
}
