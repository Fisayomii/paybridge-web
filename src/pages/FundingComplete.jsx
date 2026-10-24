import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fundings } from '../api/endpoints.js';
import { ErrorNote, KeyValues, Loading, PageHead, Status } from '../components/ui.jsx';
import { money } from '../lib/format.js';

// Paystack redirects here after checkout with ?reference=pb-fnd-...
// Set PAYBRIDGE_FUNDING_CALLBACK_URL on the backend to https://<your-frontend>/add-money/complete
export default function FundingComplete() {
  const [params] = useSearchParams();
  const reference = params.get('reference') || params.get('trxref');
  const queryClient = useQueryClient();
  const verify = useMutation({
    mutationFn: () => fundings.verify(reference),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallets'] }),
  });

  useEffect(() => {
    if (reference) verify.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  const f = verify.data;
  return (
    <div className="page page-narrow">
      <PageHead title={f?.status === 'SUCCESS' ? 'Money added' : 'Checking your payment'}>
        {f && <Status value={f.status} />}
      </PageHead>
      {!reference && <p>This page needs a payment reference. Start again from Add money.</p>}
      {verify.isPending && <Loading label="Confirming with Paystack" />}
      <ErrorNote error={verify.error} />
      {f && (
        <KeyValues
          rows={[
            ['Amount', money(f.amount, f.currency)],
            ['Wallet', f.walletNumber],
            ['Reference', f.reference],
          ]}
        />
      )}
      {f?.status === 'PENDING' && (
        <p className="muted">
          Paystack hasn't confirmed this yet. It usually takes a few seconds.{' '}
          <button className="btn btn-quiet btn-small" onClick={() => verify.mutate()}>
            Check again
          </button>
        </p>
      )}
      <div className="actions">
        <Link className="btn btn-primary" to="/">
          Back to home
        </Link>
      </div>
    </div>
  );
}
