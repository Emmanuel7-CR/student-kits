import { SUPABASE_KEY, SUPABASE_URL } from '../data/config';

/** A tiny fetch wrapper for Supabase. Publishable keys go in the apikey header only. */
export async function api(path: string, init: RequestInit = {}, timeoutMs = 20000): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(`${SUPABASE_URL}${path}`, {
      ...init,
      signal: ctl.signal,
      headers: { apikey: SUPABASE_KEY, ...(init.headers as Record<string, string> | undefined) },
    });
  } finally {
    clearTimeout(timer);
  }
}
