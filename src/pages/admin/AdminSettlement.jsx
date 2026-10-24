import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { admin, fx } from '../../api/endpoints.js';
import ActionDialog from '../../components/ActionDialog.jsx';
import { ErrorNote, KeyValues, Loading, PageHead, Status } from '../../components/ui.jsx';
import { dateTime, money, rate, titleCase } from '../../lib/format.js';
import LiveDataPanel from './LiveDataPanel.jsx';

export default function AdminSettlement() {
  const [action, setAction] = useState(null);
  const liquidity = useQuery({ queryKey: ['liquidity'], queryFn: admin.liquidity });
  const position = useQuery({ queryKey: ['fx-position'], queryFn: admin.fxPosition });
  const rates = useQuery({ queryKey: ['rates'], queryFn: fx.rates });
  const breaks = useQuery({ queryKey: ['breaks'], queryFn: () => admin.breaks('OPEN') });
  const prefunds = useQuery({ queryKey: ['prefunds'], queryFn: admin.prefunds });
  const integrity = useMutation({ mutationFn: admin.integrity });
  const trial = useMutation({ mutationFn: admin.trialBalance });

  const L = liquidity.data;
  const P = position.data;
  const R = rates.data;

  const actions = {
    prefund: {
      title: 'Book a partner prefund',
      description: 'Do this when a partner’s USD wire shows on the bank statement. The bank reference makes it safe to repeat.',
      fields: [
        { name: 'partnerAccountNumber', label: 'Partner prefund account', hint: 'e.g. PARTNER-USD-123456' },
        { name: 'amount', label: 'Amount (USD)', inputMode: 'decimal' },
        { name: 'bankReference', label: 'Bank reference', hint: 'e.g. FED-WIRE-20261015-0001' },
      ],
      submitLabel: 'Book prefund',
      run: (v) => admin.bookPrefund({ ...v, amount: Number(v.amount).toFixed(2) }),
      invalidate: [['prefunds']],
    },
    fxDeal: {
      title: 'Book an FX deal',
      description: P
        ? `Sells the whole open position of ${money(P.usdOpen, 'USD')} at the rate the bank gave you, and books the gain or loss.`
        : '',
      fields: [
        { name: 'executedRate', label: 'Executed rate (₦ per $1)', inputMode: 'decimal' },
        { name: 'bankReference', label: 'Bank deal reference', hint: 'e.g. DEAL-20261015-01' },
      ],
      submitLabel: 'Book deal',
      run: (v) => admin.bookFxDeal(v),
      invalidate: [['fx-position']],
    },
    rate: {
      title: 'Publish a mid rate',
      description: R ? `Current mid rate ₦${rate(R.midRate)}. A move bigger than the deviation limit needs “force”.` : '',
      fields: [
        { name: 'midRate', label: 'Mid rate (₦ per $1)', inputMode: 'decimal' },
        { name: 'force', label: 'Force a move over the deviation limit', type: 'checkbox' },
      ],
      submitLabel: 'Publish rate',
      run: (v) => admin.publishRate(v.midRate, v.force),
      invalidate: [['rates'], ['fx-position']],
    },
    reconcile: {
      title: 'Reconcile bank payouts',
      description: 'Compares every payout of one Lagos business day with the provider. Mismatches become breaks.',
      fields: [{ name: 'date', label: 'Business day', type: 'date', required: false, hint: 'Leave empty for today' }],
      submitLabel: 'Run reconciliation',
      run: (v) => admin.reconcilePayouts(v.date || undefined),
      invalidate: [['breaks']],
    },
    simulate: {
      title: 'Simulate a payout outcome',
      description: 'Sandbox only. Stands in for the Paystack webhook on a bank transfer.',
      fields: [
        { name: 'reference', label: 'Transfer reference', hint: 'pb-trf-…' },
        {
          name: 'event',
          label: 'Outcome',
          type: 'select',
          initial: 'transfer.success',
          options: [
            { value: 'transfer.success', label: 'Success' },
            { value: 'transfer.failed', label: 'Failed (refunds the customer)' },
            { value: 'transfer.reversed', label: 'Reversed (refunds the customer)' },
          ],
        },
        { name: 'lost', label: 'Lose the webhook (reconciliation should then find a break)', type: 'checkbox' },
      ],
      submitLabel: 'Send outcome',
      run: (v) => admin.simulatePayout(v.reference.trim(), v.event, !v.lost),
      invalidate: [['liquidity'], ['breaks']],
    },
  };

  const resolve = (b) => ({
    title: `Resolve break on ${b.reference}`,
    description: `Our ledger says ${b.ledgerStatus}, the provider says ${b.providerStatus ?? 'nothing'}.`,
    fields: [
      {
        name: 'resolution',
        label: 'Resolution',
        type: 'select',
        initial: 'ACCEPT_PROVIDER',
        options: [
          { value: 'ACCEPT_PROVIDER', label: 'Apply the provider’s status (refunds included)' },
          { value: 'CLOSED_WITH_NOTE', label: 'Close with a note (no money moves)' },
        ],
      },
      { name: 'note', label: 'Note', type: 'textarea' },
    ],
    submitLabel: 'Resolve break',
    run: (v) => admin.resolveBreak(b.id, v.resolution, v.note),
    invalidate: [['breaks']],
  });

  return (
    <div className="page">
      <PageHead title="Settlement">
        <button className="btn btn-line" onClick={() => setAction(actions.prefund)}>
          Book prefund
        </button>
        <button className="btn btn-line" onClick={() => setAction(actions.fxDeal)}>
          Book FX deal
        </button>
        <button className="btn btn-line" onClick={() => setAction(actions.rate)}>
          Publish rate
        </button>
      </PageHead>

      <LiveDataPanel />

      <div className="stat-grid">
        <section className="panel">
          <div className="block-head">
            <h2>Payout liquidity</h2>
            {L && <Status value={L.status} />}
          </div>
          {liquidity.isLoading && <Loading />}
          <ErrorNote error={liquidity.error} />
          {L && (
            <KeyValues
              rows={[
                [`${titleCase(L.provider)} balance`, money(L.providerBalance, L.currency)],
                ['Payouts in flight', money(L.payoutsInFlight, L.currency)],
                ['Headroom', <strong>{money(L.headroom, L.currency)}</strong>],
                ['Warn below', money(L.lowBalanceThreshold, L.currency)],
              ]}
            />
          )}
        </section>

        <section className="panel">
          <h2>Open FX position</h2>
          {position.isLoading && <Loading />}
          <ErrorNote error={position.error} />
          {P && (
            <KeyValues
              rows={[
                ['USD not yet sold', money(P.usdOpen, 'USD')],
                ['NGN paid out against it', money(P.ngnPaidOut)],
                ['Average rate paid', P.averagePaidOutRate ? `₦${rate(P.averagePaidOutRate)}` : '—'],
                ['Mid rate now', `₦${rate(P.currentMidRate)}`],
                ['Gain or loss if sold now', <Signed value={P.unrealisedPnl} />],
                ['Realised to date', <Signed value={P.realisedPnlToDate} />],
              ]}
            />
          )}
        </section>
      </div>

      <section className="block">
        <div className="block-head">
          <h2>Open breaks</h2>
          <div className="actions-inline">
            <button className="btn btn-quiet btn-small" onClick={() => setAction(actions.reconcile)}>
              Run reconciliation
            </button>
            {/* Sandbox only: the simulation endpoint doesn't exist when the backend uses real Paystack. */}
            {L && L.provider !== 'PAYSTACK' && (
              <button className="btn btn-quiet btn-small" onClick={() => setAction(actions.simulate)}>
                Simulate payout outcome
              </button>
            )}
          </div>
        </div>
        <ErrorNote error={breaks.error} />
        {breaks.data?.length === 0 && <p className="muted">No open breaks. Ledger and provider agree.</p>}
        {breaks.data?.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Payout</th>
                  <th>Problem</th>
                  <th>Ledger / provider</th>
                  <th className="right">Amount</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {breaks.data.map((b) => (
                  <tr key={b.id}>
                    <td className="num small">{b.reference}</td>
                    <td>
                      {titleCase(b.breakType)}
                      <div className="muted small">{b.details}</div>
                    </td>
                    <td>
                      {b.ledgerStatus} / {b.providerStatus ?? 'none'}
                    </td>
                    <td className="right num">{money(b.amount)}</td>
                    <td className="row-actions">
                      <button className="btn btn-quiet btn-small" onClick={() => setAction(resolve(b))}>
                        Resolve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="block">
        <div className="block-head">
          <h2>End-of-day checks</h2>
          <div className="actions-inline">
            <button className="btn btn-line btn-small" disabled={integrity.isPending} onClick={() => integrity.mutate()}>
              {integrity.isPending ? 'Checking…' : 'Run integrity check'}
            </button>
            <button className="btn btn-quiet btn-small" disabled={trial.isPending} onClick={() => trial.mutate()}>
              Show trial balance
            </button>
          </div>
        </div>
        <ErrorNote error={integrity.error || trial.error} />
        {integrity.data && (
          <div className="stack">
            <p className={`notice ${integrity.data.healthy ? 'notice-good' : 'notice-bad'}`}>
              {integrity.data.healthy ? 'All checks passed.' : 'Some checks failed. Investigate before closing the day.'}
            </p>
            <ul className="rows">
              {integrity.data.checks.map((c) => (
                <li key={c.name} className="row">
                  <span className="row-main">
                    <strong>{c.name}</strong>
                    <span className="muted">
                      {c.rule}. Expected {c.expected ?? '—'}, actual {c.actual ?? '—'}
                    </span>
                  </span>
                  <span className={`status status-${c.passed ? 'good' : 'bad'}`}>{c.passed ? 'Passed' : 'Failed'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {trial.data?.currencies.map((cur) => (
          <details key={cur.currency} className="trial" open>
            <summary>
              {cur.currency}: total {money(cur.total, cur.currency)} {cur.balanced ? '(balanced)' : '(NOT balanced)'}
            </summary>
            <table className="table">
              <tbody>
                {cur.accounts.map((a) => (
                  <tr key={a.accountNumber}>
                    <td className="num small">{a.accountNumber}</td>
                    <td>{a.name}</td>
                    <td className="muted">{titleCase(a.type)}</td>
                    <td className="right num">{money(a.balance, cur.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ))}
      </section>

      <section className="block">
        <h2>Recent prefunds</h2>
        <ErrorNote error={prefunds.error} />
        {prefunds.data?.length === 0 && <p className="muted">No partner prefunds booked yet.</p>}
        {prefunds.data?.length > 0 && (
          <ul className="rows">
            {prefunds.data.slice(0, 10).map((x) => (
              <li key={x.reference} className="row">
                <span className="row-main">
                  <strong>{x.partnerAccountNumber}</strong>
                  <span className="muted">
                    {x.bankReference}, {dateTime(x.createdAt)}
                  </span>
                </span>
                <span className="num amount-in">+{money(x.amount, x.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ActionDialog action={action} onClose={() => setAction(null)} />
    </div>
  );
}

function Signed({ value }) {
  const n = Number(value || 0);
  return <span className={n > 0 ? 'amount-in' : n < 0 ? 'amount-out' : ''}>{money(n)}</span>;
}
