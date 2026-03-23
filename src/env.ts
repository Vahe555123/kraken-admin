function normalizeUrlBase(value: string | undefined): string {
  return String(value ?? '').trim().replace(/\/+$/, '');
}

export const API_BASE = normalizeUrlBase(import.meta.env.VITE_API_URL);

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}
