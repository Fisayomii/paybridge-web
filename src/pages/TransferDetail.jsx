import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { transfers } from '../api/endpoints.js';
import { ErrorNote, KeyValues, Loading, PageHead, Status } from '../components/ui.jsx';
import { useBanks } from '../lib/banks.js';
import { dateTime, money } from '../lib/format.js';

const IN_FLIGHT = ['PENDING', 'PROCESSING'];

export default function TransferDetail() {
  const { reference } = useParams();
  const { state } = useLocation();
  const { nameOf } = useBanks();

  // Bank payouts finish later (Paystack webhook or reconciliation), so keep checking while in flight.
  const q = useQuery({
    queryKey: ['transfer', reference],
    queryFn: () => transfers.get(reference),
    refetchInterval: (query) => (IN_FLIGHT.includes(query.state.data?.status) ? 4000 : false),
  });
  const t = q.data;

  if (q.isLoading) return <Loading label="Loading transfer" />;
  if (q.error) return <ErrorNote error={q.error} />;

  const headline = {
    SUCCESS: state?.justSent ? 'Money sent' : 'Transfer complete',
    PENDING: 'On its way',
    PROCESSING: 'On its way',
    FAILED: 'Transfer failed',
    REVERSED: 'Transfer reversed',
  }[t.status];

  return (
    <div className="page page-narrow">
      <PageHead title={headline ?? 'Transfer'}>
        <Status value={t.status} />
      </PageHead>

      <section className={`receipt receipt-${t.status.toLowerCase()}`}>
        <p className="receipt-amount num">{money(t.amount, t.currency)}</p>
        <p className="receipt-to">
          to <strong>{t.beneficiaryName || t.destinationWalletNumber}</strong>
        </p>
        {IN_FLIGHT.includes(t.status) && (
          <p className="muted">
            Your bank payout has been accepted. This page updates by itself when the bank confirms it.
          </p>
        )}
        {(t.status === 'FAILED' || t.status === 'REVERSED') && (
          <p className="notice notice-bad">
            {t.failureReason || 'The bank did not accept this payout.'} The amount and fee have been returned to
            your wallet.
          </p>
        )}
      </section>

      <KeyValues
        rows={[
          ['Reference', <span className="num">{t.reference}</span>],
          ['Type', t.type === 'EXTERNAL' ? 'Bank transfer' : 'PayBridge wallet transfer'],
          t.type === 'EXTERNAL'
            ? ['Bank', `${nameOf(t.beneficiaryBankCode)}, ${t.beneficiaryAccountNumber}`]
            : ['Recipient wallet', t.destinationWalletNumber],
          ['From wallet', t.sourceWalletNumber],
          ['Amount', money(t.amount, t.currency)],
          ['Fee', money(t.fee, t.currency)],
          ['Total debited', money(t.totalDebit, t.currency)],
          ['Description', t.narration],
          ['Started', dateTime(t.createdAt)],
          t.completedAt && ['Finished', dateTime(t.completedAt)],
          ['Your balance after', money(t.sourceWalletBalance, t.currency)],
        ]}
      />

      <div className="actions">
        <Link className="btn btn-primary" to="/send">
          Send another
        </Link>
        <Link className="btn btn-line" to="/">
          Back to home
        </Link>
      </div>
    </div>
  );
}
