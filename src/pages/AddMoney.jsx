import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fundings, wallets } from '../api/endpoints.js';
import { ErrorNote, Field, KeyValues, Loading, PageHead, Status } from '../components/ui.jsx';
import { money, newKey } from '../lib/format.js';

const QUICK = [5000, 20000, 50000];

export default function AddMoney() {
  const queryClient = useQueryClient();
  const walletsQ = useQuery({ queryKey: ['wallets'], queryFn: wallets.list });
  const ngn = (walletsQ.data ?? []).filter((w) => w.currency === 'NGN');
  const [walletNumber, setWalletNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [funding, setFunding] = useState(null); // the top-up we're working on
  const key = useRef(newKey('topup'));

  const target = ngn.find((w) => w.walletNumber === walletNumber) ?? ngn[0];

  const start = useMutation({
    mutationFn: () => fundings.start(target.walletNumber, Number(amount).toFixed(2), key.current),
    onSuccess: (f) => {
      key.current = newKey('topup');
      setFunding(f);
    },
  });

  const refresh = (f) => {
    setFunding(f);
    if (f.status === 'SUCCESS') {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['statement'] });
      queryClient.invalidateQueries({ queryKey: ['fundings'] });
    }
  };
  const verify = useMutation({ mutationFn: () => fundings.verify(funding.reference), onSuccess: refresh });
  const simulate = useMutation({
    mutationFn: (success) => fundings.simulatePay(funding.reference, success),
    onSuccess: refresh,
  });

  // The simulated provider hands out checkout links on a made-up domain; real Paystack links don't match.
  const isSandbox = funding?.authorizationUrl?.includes('simulated');

  if (walletsQ.isLoading) return <Loading />;

  if (funding) {
    return (
      <div className="page page-narrow">
        <PageHead title={funding.status === 'SUCCESS' ? 'Money added' : 'Finish your payment'}>
          <Status value={funding.status} />
        </PageHead>
        <KeyValues
          rows={[
            ['Amount', money(funding.amount, funding.currency)],
            ['Into wallet', funding.walletNumber],
            ['Reference', <span className="num">{funding.reference}</span>],
            funding.reason && ['Note', funding.reason],
          ]}
        />

        {funding.status === 'PENDING' && (
          <div className="stack">
            {isSandbox ? (
              <>
                <p className="notice notice-wait">
                  The backend is in sandbox mode, so there's no real checkout page. Choose what the customer does:
                </p>
                <div className="actions">
                  <button className="btn btn-primary" disabled={simulate.isPending} onClick={() => simulate.mutate(true)}>
                    Simulate a successful payment
                  </button>
                  <button className="btn btn-line" disabled={simulate.isPending} onClick={() => simulate.mutate(false)}>
                    Simulate a failed payment
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>Pay on Paystack's secure page. Your wallet is credited once PayBridge confirms the payment.</p>
                <div className="actions">
                  <a className="btn btn-primary" href={funding.authorizationUrl}>
                    Pay {money(funding.amount)} on Paystack
                  </a>
                  <button className="btn btn-line" disabled={verify.isPending} onClick={() => verify.mutate()}>
                    {verify.isPending ? 'Checking…' : "I've paid, check now"}
                  </button>
                </div>
              </>
            )}
            <ErrorNote error={simulate.error || verify.error} />
          </div>
        )}

        {funding.status !== 'PENDING' && (
          <div className="actions">
            <button className="btn btn-primary" onClick={() => setFunding(null)}>
              Add more money
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page page-narrow">
      <PageHead title="Add money" />
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (Number(amount) >= 100) start.mutate();
        }}
      >
        {ngn.length > 1 && (
          <Field label="Wallet">
            <select value={target?.walletNumber} onChange={(e) => setWalletNumber(e.target.value)}>
              {ngn.map((w) => (
                <option key={w.walletNumber} value={w.walletNumber}>
                  {w.walletNumber}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Amount (₦)" hint="At least ₦100. You pay by card, bank transfer or USSD on Paystack.">
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          />
        </Field>
        <div className="chips">
          {QUICK.map((v) => (
            <button type="button" key={v} className="chip" onClick={() => setAmount(String(v))}>
              {money(v)}
            </button>
          ))}
        </div>
        <ErrorNote error={start.error} />
        <button className="btn btn-primary btn-wide" disabled={Number(amount) < 100 || start.isPending}>
          {start.isPending ? 'Starting…' : 'Continue to payment'}
        </button>
      </form>
    </div>
  );
}
