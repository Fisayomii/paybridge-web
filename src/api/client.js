// One place that talks to the PayBridge API.
//
// - Adds "Authorization: Bearer <accessToken>" to every call except login/register/refresh
//   (sending an old token to login is what caused the 401s you saw in Swagger).
// - When a call comes back 401, it swaps the refresh token for a new pair once and retries.
//   If that fails too, the session is cleared and the app returns to the login page.
// - Turns the backend's { "error": "..." } body into an ApiError with that message.

import { getSession, setSession, clearSession } from '../auth/session.js';

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// Render's free plan puts the backend to sleep. If a call takes this long we tell the user why.
const SLOW_AFTER_MS = 6000;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let refreshInFlight = null;

async function refreshTokens() {
  // Several calls can hit a 401 at the same moment; they all wait for one refresh.
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const session = getSession();
      if (!session?.refreshToken) throw new ApiError(401, 'Your session has ended. Log in again.');
      const data = await request('/api/v1/auth/refresh', {
        method: 'POST',
        body: { refreshToken: session.refreshToken },
        auth: false,
        retryOn401: false,
      });
      setSession(data);
      return data;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function notifySlow(isSlow) {
  window.dispatchEvent(new CustomEvent('pb:slow', { detail: isSlow }));
}

export async function request(path, { method = 'GET', body, headers = {}, auth = true, retryOn401 = true } = {}) {
  const finalHeaders = { Accept: 'application/json', ...headers };
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  if (auth) {
    const token = getSession()?.accessToken;
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const slowTimer = setTimeout(() => notifySlow(true), SLOW_AFTER_MS);
  let response;
  try {
    response = await fetch(BASE_URL + path, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach PayBridge. Check your connection, or that the server is running.');
  } finally {
    clearTimeout(slowTimer);
    notifySlow(false);
  }

  if (response.status === 401 && auth && retryOn401) {
    try {
      await refreshTokens();
    } catch {
      clearSession();
      throw new ApiError(401, 'Your session has ended. Log in again.');
    }
    return request(path, { method, body, headers, auth, retryOn401: false });
  }

  if (response.status === 204) return null;

  const text = await response.text();
  const data = text ? safeJson(text) : null;

  if (!response.ok) {
    const message = (data && (data.error || data.message)) || `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }
  return data;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

// Spring Data pages come back either as { content, totalPages, number }
// or, in newer versions, as { content, page: { totalPages, number } }. Read both.
export function pageOf(data) {
  const meta = data?.page ?? data ?? {};
  return {
    items: data?.content ?? [],
    page: meta.number ?? 0,
    totalPages: meta.totalPages ?? 1,
    totalElements: meta.totalElements ?? (data?.content?.length || 0),
  };
}
