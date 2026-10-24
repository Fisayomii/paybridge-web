import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fx, partner } from '../../api/endpoints.js';
import { pageOf } from '../../api/client.js';
import { Balance, Empty, ErrorNote, Field, KeyValues, Loading, PageHead, Pager, Status } from '../../components/ui.jsx';
import { dateTime, money, newKey, rate } from '../../lib/format.js';

const EMPTY_SENDER = {
  partnerReference: '',
  senderName: '',
  senderCountry: 'US',
  senderIdNumber: '',
  senderAddress: '',
  recipientName: '',
  recipientWalletNumber: '',
  purpose: 'Family support',
};

export default function PartnerHome() {
  const queryClient = useQueryClient();
  const account = useQuery({ queryKey: ['partner-account'], queryFn: partner.account });
  const rates = useQuery({ queryKey: ['rates'], queryFn: fx.rates, refetchInterval: 60_000 });
  const [page, setPage] = useState(0);
  const list = useQuery({
    queryKey: ['partner-remittances', page],
    queryFn: () => partner.remittances(page, 20),
    placeholderData: (prev) => prev,
  });

  const [amountUsd, setAmountUsd] = useState('');
  const [quote, setQuote] = useState(null);
  const [details, setDetails] = useState(EMPTY_SENDER);
  const [result, setResult] = useState(null);
  const key = useRef(newKey('rem'));

  const getQuote = useMutation({
    mutationFn: () => partner.quote(Number(amountUsd).toFixed(2)),
    onSuccess: (q) => {
      setQuote(q);
      setResult(null);
    },
  });
  const send = useMutation({
    mutationFn: () =>
      partner.send(
        { ...details, quoteReference: quote.reference, senderCountry: details.senderCountry.toUpperCase() },
        key.current
      ),
    onSuccess: (r) => {
      key.current = newKey('rem');
      setResult(r);
      setQuote(null);
      setDetails(EMPTY_SENDER);
      queryClient.invalidateQueries({ queryKey: ['partner-account'] });
      queryClient.invalidateQueries({ queryKey: ['partner-remittances'] });
    },
  });

  const set = (k) => (e) => setDetails({ ...details, [k]: e.target.value });
  const secondsLeft = useCountdown(quote?.expiresAt);
  const expired = quote && secondsLeft <= 0;
  const p = list.data ? pageOf(list.data) : null;
  const r = rates.data;

  return (
    <div className="page">
      <PageHead title={account.data?.partnerName ?? 'Partner'} />
      <ErrorNote error={account.error} />

      <section className="hero hero-split">
        <div>
          <span className="hero-label">USD prefund available</span>
          {account.data ? <Balance amount={account.data.prefundBalance} currency="USD" /> : <Loading />}
          {account.data && (
            <p className="muted">
              Prefund account <span className="num">{account.data.accountNumber}</span>. Wire USD to top it up;
              PayBridge operations books it when it reaches our bank.
            </p>
          )}
        </div>
        {r && (
          <div className="rate-card">
            <span className="hero-label">Today's rate</span>
            <p className="rate-big num">
              $1 = ₦{rate(r.customerRate)}
            </p>
            <p className="muted small">
              Mid rate ₦{rate(r.midRate)}, our spread {r.spreadPercent}%, fee {money(r.feeUsd, 'USD')} per remittance.
              Quotes hold for {Math.round(r.quoteValiditySeconds / 60)} minutes.
            </p>
            {r.stale && <p className="notice notice-wait">Quoting is paused: the rate feed is out of date.</p>}
          </div>
        )}
      </section>

      <div className="two-col">
        <section className="panel">
          <h2>New remittance</h2>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              getQuote.mutate();
            }}
          >
            <Field label="Amount the recipient should get, in USD" hint="Between $10 and $10,000">
              <input
                inputMode="decimal"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value.replace(/[^\d.]/g, ''))}
              />
            </Field>
            <ErrorNote error={getQuote.error} />
            <button className="btn btn-line" disabled={!Number(amountUsd) || getQuote.isPending}>
              {quote ? 'Get a new quote' : 'Get a quote'}
            </button>
          </form>

          {quote && (
            <div className={`quote ${expired ? 'quote-expired' : ''}`}>
              <p className="quote-main num">
                {money(quote.sourceAmount, 'USD')} becomes <strong>{money(quote.targetAmount, 'NGN')}</strong>
              </p>
              <p className="muted small">
                Rate ₦{rate(quote.rate)} per $1. Fee {money(quote.fee, 'USD')}. You pay{' '}
                {money(quote.totalCost, 'USD')} from your prefund.
              </p>
              <p className={expired ? 'field-error' : 'muted small'}>
                {expired ? 'This quote has expired. Get a new one.' : `Valid for ${formatSeconds(secondsLeft)}`}
              </p>
            </div>
          )}

          {quote && !expired && (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate();
              }}
            >
              <h3>Sender, as verified by you</h3>
              <Field label="Full name">
                <input required value={details.senderName} onChange={set('senderName')} />
              </Field>
              <div className="field-row">
                <Field label="Country" hint="2-letter code">
                  <input required maxLength={2} value={details.senderCountry} onChange={set('senderCountry')} />
                </Field>
                <Field label="ID number">
                  <input required value={details.senderIdNumber} onChange={set('senderIdNumber')} />
                </Field>
              </div>
              <Field label="Address">
                <input required value={details.senderAddress} onChange={set('senderAddress')} />
              </Field>
              <h3>Recipient in Nigeria</h3>
              <Field label="Full name">
                <input required value={details.recipientName} onChange={set('recipientName')} />
              </Field>
              <Field label="PayBridge wallet number">
                <input
                  required
                  inputMode="numeric"
                  maxLength={10}
                  value={details.recipientWalletNumber}
                  onChange={set('recipientWalletNumber')}
                />
              </Field>
              <div className="field-row">
                <Field label="Purpose">
                  <input required value={details.purpose} onChange={set('purpose')} />
                </Field>
                <Field label="Your reference" hint="Optional">
                  <input value={details.partnerReference} onChange={set('partnerReference')} />
                </Field>
              </div>
              <ErrorNote error={send.error} />
              <button className="btn btn-primary btn-wide" disabled={send.isPending}>
                {send.isPending ? 'Sending…' : `Send ${money(quote.targetAmount, 'NGN')}`}
              </button>
            </form>
          )}

          {result && <RemittanceResult r={result} />}
        </section>

        <section>
          <h2>Your remittances</h2>
          {list.isLoading && <Loading />}
          <ErrorNote error={list.error} />
          {p && p.items.length === 0 && <Empty>Remittances you send appear here.</Empty>}
          {p && p.items.length > 0 && (
            <ul className="rows">
              {p.items.map((x) => (
                <li key={x.reference} className="row">
                  <span className="row-main">
                    <strong>{x.recipientName}</strong>
                    <span className="muted">
                      from {x.senderName}, {dateTime(x.createdAt)}
                    </span>
                  </span>
                  <span className="row-end">
                    <span className="num">{money(x.targetAmount, x.targetCurrency)}</span>
                    <Status value={x.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {p && <Pager page={p.page} totalPages={p.totalPages} onChange={setPage} />}
        </section>
      </div>
    </div>
  );
}

function RemittanceResult({ r }) {
  const message = {
    COMPLETED: 'Delivered. The recipient’s wallet has been credited.',
    PENDING_REVIEW: 'Held for a compliance review. Funds are reserved; you’ll see the outcome here.',
    REJECTED: 'Blocked by screening. Nothing was taken from your prefund.',
    FAILED: 'Could not be delivered. Your prefund has been refunded.',
  }[r.status];
  return (
    <div className="stack">
      <p className={`notice ${r.status === 'COMPLETED' ? 'notice-good' : r.status === 'PENDING_REVIEW' ? 'notice-wait' : 'notice-bad'}`}>
        {message}
      </p>
      <KeyValues
        rows={[
          ['Reference', r.reference],
          ['Recipient', `${r.recipientName}, wallet ${r.recipientWalletNumber}`],
          ['Credited', money(r.targetAmount, r.targetCurrency)],
          ['Charged to prefund', money(r.totalCharged, r.sourceCurrency)],
          r.screeningNotes && ['Screening', r.screeningNotes],
        ]}
      />
    </div>
  );
}

function useCountdown(iso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!iso) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [iso]);
  return iso ? Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000)) : 0;
}

function formatSeconds(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
