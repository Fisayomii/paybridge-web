// Small building blocks used on every page.
import { useEffect, useRef } from 'react';
import { money, moneyParts, titleCase } from '../lib/format.js';

export function PageHead({ title, children }) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {children && <div className="page-head-actions">{children}</div>}
    </header>
  );
}

// The one big moment: the balance, with the kobo set small.
export function Balance({ amount, currency }) {
  const { symbol, whole, minor } = moneyParts(amount, currency);
  return (
    <p className="balance" aria-label={money(amount, currency)}>
      <span className="balance-symbol">{symbol}</span>
      <span className="balance-whole">{whole}</span>
      <span className="balance-minor">.{minor}</span>
    </p>
  );
}

// Credits in green with a plus, debits in black with a minus.
export function Amount({ value, currency, direction }) {
  const sign = direction === 'CREDIT' ? '+' : direction === 'DEBIT' ? '−' : '';
  return (
    <span className={`amount ${direction === 'CREDIT' ? 'amount-in' : ''}`}>
      {sign}
      {money(value, currency)}
    </span>
  );
}

const TONE = {
  SUCCESS: 'good', COMPLETED: 'good', ACTIVE: 'good', VERIFIED: 'good', OK: 'good', RESOLVED: 'good',
  PENDING: 'wait', PROCESSING: 'wait', PENDING_REVIEW: 'wait', LOW: 'wait', POST_NO_DEBIT: 'wait', OPEN: 'wait',
  FAILED: 'bad', REVERSED: 'bad', REJECTED: 'bad', ABANDONED: 'bad', FROZEN: 'bad', SUSPENDED: 'bad',
  INSUFFICIENT: 'bad',
};

export function Status({ value }) {
  if (!value) return null;
  const label = value === 'OK' ? 'Healthy' : titleCase(value);
  return <span className={`status status-${TONE[value] ?? 'plain'}`}>{label}</span>;
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return (
    <p className="notice notice-bad" role="alert">
      {error.message || String(error)}
    </p>
  );
}

export function Loading({ label = 'Loading' }) {
  return <p className="muted loading">{label}…</p>;
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function Pager({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="pager">
      <button className="btn btn-quiet" disabled={page <= 0} onClick={() => onChange(page - 1)}>
        Newer
      </button>
      <span className="muted">
        Page {page + 1} of {totalPages}
      </span>
      <button className="btn btn-quiet" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>
        Older
      </button>
    </div>
  );
}

// A native <dialog> used by the admin pages for "give a reason" style actions.
export function Dialog({ open, title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dialog" onClose={onClose}>
      <div className="dialog-head">
        <h2>{title}</h2>
        <button className="btn btn-quiet" onClick={onClose} aria-label="Close">
          Close
        </button>
      </div>
      {open && children}
    </dialog>
  );
}

export function KeyValues({ rows }) {
  return (
    <dl className="kv">
      {rows
        .filter(Boolean)
        .map(([k, v]) => (
          <div key={k} className="kv-row">
            <dt>{k}</dt>
            <dd>{v ?? '—'}</dd>
          </div>
        ))}
    </dl>
  );
}
