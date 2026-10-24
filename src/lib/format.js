const formatters = new Map();

function formatter(currency) {
  if (!formatters.has(currency)) {
    formatters.set(
      currency,
      new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: currency || 'NGN',
        currencyDisplay: 'narrowSymbol', // "$" rather than "US$"
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  return formatters.get(currency);
}

// 152300.5, 'NGN' -> "₦152,300.50"
export function money(amount, currency = 'NGN') {
  if (amount === null || amount === undefined || amount === '') return '—';
  return formatter(currency).format(Number(amount));
}

// Splits a balance into symbol, whole part and kobo/cents, for the big balance display.
export function moneyParts(amount, currency = 'NGN') {
  const parts = formatter(currency).formatToParts(Number(amount || 0));
  let symbol = '';
  let whole = '';
  let minor = '';
  let negative = false;
  for (const p of parts) {
    if (p.type === 'currency') symbol = p.value;
    else if (p.type === 'minusSign') negative = true;
    else if (p.type === 'fraction') minor = p.value;
    else if (p.type === 'integer' || p.type === 'group') whole += p.value;
  }
  return { symbol, whole: (negative ? '−' : '') + whole, minor };
}

export function dateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function rate(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('en-NG', { maximumFractionDigits: 4 });
}

export function titleCase(value) {
  if (!value) return '';
  const s = String(value).replaceAll('_', ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function newKey(prefix = 'web') {
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}
