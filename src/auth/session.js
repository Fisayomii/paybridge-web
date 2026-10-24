// The logged-in session lives in localStorage so a page refresh keeps you signed in.
// Trade-off: any script running on the page could read it. That's acceptable here because the
// access token is short-lived and the app loads no third-party scripts. A bank would move the
// refresh token into an httpOnly cookie, which needs backend changes.

const KEY = 'paybridge.session';

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

// Accepts the backend's AuthResponse: { accessToken, refreshToken, expiresIn, customer }.
export function setSession(auth) {
  const session = {
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    customer: auth.customer ?? getSession()?.customer ?? null,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage blocked: the session still works until the tab closes */
  }
  window.dispatchEvent(new CustomEvent('pb:session', { detail: session }));
  return session;
}

export function updateCustomer(customer) {
  const current = getSession();
  if (current) setSession({ ...current, customer });
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('pb:session', { detail: null }));
}
