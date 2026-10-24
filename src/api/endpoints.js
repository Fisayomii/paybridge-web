// Every backend endpoint the app uses, named by what it does.
// Paths and bodies match the Spring controllers one for one.

import { request } from './client.js';

const json = (method, body, headers) => ({ method, body, headers });
const idem = (key) => ({ 'Idempotency-Key': key });
const qs = (params) => {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return s ? `?${s}` : '';
};

// ---- Auth and profile
export const auth = {
  register: (body) => request('/api/v1/auth/register', { ...json('POST', body), auth: false }),
  login: (body) => request('/api/v1/auth/login', { ...json('POST', body), auth: false }),
  logout: (refreshToken) => request('/api/v1/auth/logout', json('POST', { refreshToken })),
  me: () => request('/api/v1/auth/me'),
};

export const kyc = {
  verifyBvn: (bvn) => request('/api/v1/kyc/bvn', json('POST', { bvn })),
  history: () => request('/api/v1/kyc'),
};

// ---- Wallets
export const wallets = {
  list: () => request('/api/v1/accounts'),
  get: (walletNumber) => request(`/api/v1/accounts/${walletNumber}`),
  open: (currency) => request('/api/v1/accounts', json('POST', { currency })),
  statement: (walletNumber, page = 0, size = 30) =>
    request(`/api/v1/accounts/${walletNumber}/statement${qs({ page, size })}`),
  lookup: (walletNumber) => request(`/api/v1/accounts/lookup${qs({ walletNumber })}`),
};

// ---- Transfers
export const transfers = {
  list: (page = 0, size = 20) => request(`/api/v1/transfers${qs({ page, size })}`),
  get: (reference) => request(`/api/v1/transfers/${reference}`),
  banks: () => request('/api/v1/transfers/banks'),
  fee: (type, amount) => request(`/api/v1/transfers/fees${qs({ type, amount })}`),
  resolveBank: (accountNumber, bankCode) =>
    request(`/api/v1/transfers/banks/resolve${qs({ accountNumber, bankCode })}`),
  sendInternal: (body, key) => request('/api/v1/transfers/internal', json('POST', body, idem(key))),
  sendExternal: (body, key) => request('/api/v1/transfers/external', json('POST', body, idem(key))),
};

export const beneficiaries = {
  list: () => request('/api/v1/beneficiaries'),
  add: (body) => request('/api/v1/beneficiaries', json('POST', body)),
  remove: (id) => request(`/api/v1/beneficiaries/${id}`, { method: 'DELETE' }),
};

// ---- Funding (top-ups)
export const fundings = {
  start: (walletNumber, amount, key) =>
    request('/api/v1/fundings', json('POST', { walletNumber, amount }, idem(key))),
  verify: (reference) => request(`/api/v1/fundings/${reference}/verify`, { method: 'POST' }),
  get: (reference) => request(`/api/v1/fundings/${reference}`),
  list: (walletNumber, page = 0, size = 10) => request(`/api/v1/fundings${qs({ walletNumber, page, size })}`),
  // Only exists when the backend runs with PAYBRIDGE_PAYMENTS_PROVIDER=simulated.
  simulatePay: (reference, success = true) =>
    request(`/api/v1/fundings/simulations/${reference}/pay`, json('POST', { success })),
};

// ---- FX
export const fx = {
  rates: () => request('/api/v1/fx/rates'),
};

// ---- Partner API
export const partner = {
  account: () => request('/api/v1/partner/account'),
  statement: (page = 0, size = 20) => request(`/api/v1/partner/account/statement${qs({ page, size })}`),
  quote: (amountUsd) => request('/api/v1/partner/quotes', json('POST', { amountUsd })),
  send: (body, key) => request('/api/v1/partner/remittances', json('POST', body, idem(key))),
  remittances: (page = 0, size = 20) => request(`/api/v1/partner/remittances${qs({ page, size })}`),
};

// ---- Admin
export const admin = {
  customers: (page = 0, size = 50) => request(`/api/v1/admin/customers${qs({ page, size })}`),
  setTier: (id, tier, reason) => request(`/api/v1/admin/customers/${id}/kyc-tier`, json('PUT', { tier, reason })),
  setCustomerStatus: (id, status, reason) =>
    request(`/api/v1/admin/customers/${id}/status`, json('PUT', { status, reason })),
  createPartner: (body) => request('/api/v1/admin/partners', json('POST', body)),

  wallets: (page = 0, size = 50) => request(`/api/v1/admin/accounts${qs({ page, size })}`),
  setWalletStatus: (walletNumber, status, reason) =>
    request(`/api/v1/admin/accounts/${walletNumber}/status`, json('POST', { status, reason })),
  adjust: (walletNumber, body, key) =>
    request(`/api/v1/admin/accounts/${walletNumber}/adjustments`, json('POST', body, idem(key))),

  remittances: (status, page = 0, size = 50) =>
    request(`/api/v1/admin/remittances${qs({ status, page, size })}`),
  approve: (reference, note) => request(`/api/v1/admin/remittances/${reference}/approve`, json('POST', { note })),
  reject: (reference, note) => request(`/api/v1/admin/remittances/${reference}/reject`, json('POST', { note })),

  sanctionsStatus: () => request('/api/v1/admin/compliance/sanctions/status'),
  refreshSanctions: () => request('/api/v1/admin/compliance/sanctions/refresh', { method: 'POST' }),
  screenName: (name) => request(`/api/v1/admin/compliance/sanctions/screen${qs({ name })}`),

  publishRate: (midRate, force) => request('/api/v1/admin/fx/rates', json('PUT', { midRate, force })),

  liquidity: () => request('/api/v1/admin/settlement/liquidity'),
  fxPosition: () => request('/api/v1/admin/settlement/fx-position'),
  integrity: () => request('/api/v1/admin/settlement/integrity-check'),
  trialBalance: () => request('/api/v1/admin/settlement/trial-balance'),
  prefunds: () => request('/api/v1/admin/settlement/prefunds'),
  bookPrefund: (body) => request('/api/v1/admin/settlement/prefunds', json('POST', body)),
  fxDeals: () => request('/api/v1/admin/settlement/fx-deals'),
  bookFxDeal: (body) => request('/api/v1/admin/settlement/fx-deals', json('POST', body)),
  reconcilePayouts: (date) =>
    request(`/api/v1/admin/settlement/reconciliations/payouts${qs({ date })}`, { method: 'POST' }),
  breaks: (status) => request(`/api/v1/admin/settlement/breaks${qs({ status })}`),
  resolveBreak: (id, resolution, note) =>
    request(`/api/v1/admin/settlement/breaks/${id}/resolve`, json('POST', { resolution, note })),
  // Sandbox only (simulated provider).
  simulatePayout: (reference, event, sendWebhook = true) =>
    request(`/api/v1/admin/simulations/transfers/${reference}/webhook`, json('POST', { event, sendWebhook })),
};
