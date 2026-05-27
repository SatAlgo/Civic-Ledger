const TOKEN_KEY = 'civic_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

interface ApiOptions extends RequestInit {
  json?: any;
}

export async function api<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { json, headers, ...rest } = options;
  const token = getToken();

  const finalHeaders: Record<string, string> = {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers as Record<string, string>),
  };

  const base = process.env.NEXT_PUBLIC_API_URL || '';
  // If path already starts with http(s), use it as-is. Otherwise, prefix with base.
  const url = /^https?:\/\//.test(path) ? path : `${base}${path}`;

  const res = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: json ? JSON.stringify(json) : (rest.body as any),
  });

  // if (!res.ok) {
  //   let message = `Request failed (${res.status})`;
  //   try {
  //     const err = await res.json();
  //     message = err.error || err.message || message;
  //   } catch {}
  //   throw new Error(message);
  // }


  if (!res.ok) {
    // 401 means the token is invalid/expired — wipe it so the app stops
    // pretending we're logged in. The AuthProvider re-checks on next render.
    if (res.status === 401 && typeof window !== 'undefined') {
      clearToken();
    }
    let message = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      message = err.error || err.message || message;
    } catch {}
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
