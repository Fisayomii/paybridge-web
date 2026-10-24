import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { admin } from '../../api/endpoints.js';
import { pageOf } from '../../api/client.js';
import ActionDialog from '../../components/ActionDialog.jsx';
import { Empty, ErrorNote, KeyValues, Loading, PageHead, Pager, Status } from '../../components/ui.jsx';
import { dateTime, money, rate, titleCase } from '../../lib/format.js';

const FILTERS = ['PENDING_REVIEW', 'COMPLETED', 'REJECTED', 'FAILED', ''];

export default function AdminReviews() {
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [page, setPage] = useState(0);
  const [action, setAction] = useState(null);
  const q = useQuery({
    queryKey: ['admin-remittances', status, page],
    queryFn: () => admin.remittances(status || undefined, page, 50),
    placeholderData: (prev) => prev,
  });
  const p = q.data ? pageOf(q.data) : null;

  const decide = (r, approve) => ({
    title: `${approve ? 'Approve' : 'Reject'} ${r.reference}`,
    description: approve
      ? `${r.recipientName}'s wallet is credited ${money(r.targetAmount, r.targetCurrency)} at the rate locked when it arrived.`
      : `The partner gets ${money(r.totalCharged, r.sourceCurrency)} back on their prefund.`,
    fields: [{ name: 'note', label: 'Review note', type: 'textarea', hint: 'e.g. Date of birth differs from the watchlist entry; false positive' }],
    submitLabel: approve ? 'Approve and pay' : 'Reject and refund',
    danger: !approve,
    run: (v) => (approve ? admin.approve(r.reference, v.note) : admin.reject(r.reference, v.note)),
    invalidate: [['admin-remittances']],
  });

  return (
    <div className="page">
      <PageHead title="Remittance review" />
      <div className="segmented segmented-wrap" role="tablist" aria-label="Filter by status">
        {FILTERS.map((s) => (
          <button
            key={s || 'all'}
            role="tab"
            aria-selected={status === s}
            onClick={() => {
              setStatus(s);
              setPage(0);
            }}
          >
            {s ? titleCase(s) : 'All'}
          </button>
        ))}
      </div>

      {q.isLoading && <Loading />}
      <ErrorNote error={q.error} />
      {p && p.items.length === 0 && (
        <Empty>{status === 'PENDING_REVIEW' ? 'Nothing waiting for review.' : 'No remittances here.'}</Empty>
      )}
      {p?.items.map((r) => (
        <article key={r.reference} className="panel review">
          <div className="review-head">
            <div>
              <strong>
                {r.senderName} ({r.senderCountry}) to {r.recipientName}
              </strong>
              <div className="muted small">
                {r.reference}, {dateTime(r.createdAt)}
              </div>
            </div>
            <Status value={r.status} />
          </div>
          {r.screeningNotes && <p className="notice notice-wait">{r.screeningNotes}</p>}
          <KeyValues
            rows={[
              ['Sent', money(r.sourceAmount, r.sourceCurrency)],
              ['To be credited', `${money(r.targetAmount, r.targetCurrency)} at ₦${rate(r.rate)}`],
              ['Recipient wallet', r.recipientWalletNumber],
              ['Purpose', r.purpose],
              r.reviewNote && ['Review note', r.reviewNote],
              r.failureReason && ['Failure', r.failureReason],
            ]}
          />
          {r.status === 'PENDING_REVIEW' && (
            <div className="actions">
              <button className="btn btn-primary" onClick={() => setAction(decide(r, true))}>
                Approve
              </button>
              <button className="btn btn-line" onClick={() => setAction(decide(r, false))}>
                Reject
              </button>
            </div>
          )}
        </article>
      ))}
      {p && <Pager page={p.page} totalPages={p.totalPages} onChange={setPage} />}
      <ActionDialog action={action} onClose={() => setAction(null)} />
    </div>
  );
}
