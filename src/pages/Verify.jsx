import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { auth, kyc } from '../api/endpoints.js';
import { updateCustomer } from '../auth/session.js';
import { ErrorNote, Field, PageHead, Status } from '../components/ui.jsx';
import { dateTime, money } from '../lib/format.js';

// Matches paybridge.compliance.tiers in application.yml.
const TIERS = [
  { tier: 1, single: 50000, daily: 50000, balance: 300000, how: 'Open an account' },
  { tier: 2, single: 100000, daily: 200000, balance: 500000, how: 'Verify your BVN' },
  { tier: 3, single: 5000000, daily: 25000000, balance: null, how: 'Full KYC with PayBridge operations' },
];

export default function Verify() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: auth.me });
  const history = useQuery({ queryKey: ['kyc'], queryFn: kyc.history });
  const [bvn, setBvn] = useState('');

  const verify = useMutation({
    mutationFn: () => kyc.verifyBvn(bvn),
    onSuccess: async () => {
      setBvn('');
      const fresh = await auth.me();
      updateCustomer(fresh);
      queryClient.setQueryData(['me'], fresh);
      queryClient.invalidateQueries({ queryKey: ['kyc'] });
    },
  });

  const tier = me.data?.kycTier ?? 1;
  const result = verify.data;

  return (
    <div className="page page-narrow">
      <PageHead title="Verify your identity" />

      <div className="table-wrap">
        <table className="table tiers">
          <thead>
            <tr>
              <th>Level</th>
              <th className="right">Per transfer</th>
              <th className="right">Per day</th>
              <th className="right">Max balance</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((t) => (
              <tr key={t.tier} className={t.tier === tier ? 'tier-current' : ''}>
                <td>
                  <strong>Tier {t.tier}</strong>
                  {t.tier === tier && <span className="you">You're here</span>}
                  <div className="muted small">{t.how}</div>
                </td>
                <td className="right num">{money(t.single)}</td>
                <td className="right num">{money(t.daily)}</td>
                <td className="right num">{t.balance ? money(t.balance) : 'No limit'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tier < 2 && (
        <form
          className="form panel"
          onSubmit={(e) => {
            e.preventDefault();
            verify.mutate();
          }}
        >
          <h2>Verify your BVN</h2>
          <p className="muted">
            We check that the name on your BVN matches <strong>{me.data?.fullName}</strong>. Dial *565*0# on your
            registered line to get your BVN.
          </p>
          <Field
            label="BVN"
            hint="11 digits. Sandbox: the simulated provider matches every BVN to Ada Obi; Dojah's sandbox uses 22222222222."
          >
            <input
              inputMode="numeric"
              maxLength={11}
              value={bvn}
              onChange={(e) => setBvn(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <ErrorNote error={verify.error} />
          <button className="btn btn-primary" disabled={bvn.length !== 11 || verify.isPending}>
            {verify.isPending ? 'Verifying…' : 'Verify BVN'}
          </button>
        </form>
      )}

      {result && (
        <p className={`notice ${result.status === 'VERIFIED' ? 'notice-good' : 'notice-bad'}`} role="status">
          {result.status === 'VERIFIED'
            ? `Verified. You're now on tier ${result.tierAfter}.`
            : `We couldn't verify that BVN: ${result.failureReason || 'the details did not match'}.`}
        </p>
      )}

      {history.data?.length > 0 && (
        <section className="block">
          <h2>Verification attempts</h2>
          <ul className="rows">
            {history.data.map((h, i) => (
              <li key={i} className="row">
                <span className="row-main">
                  <strong>
                    {h.idType} {h.idNumber}
                  </strong>
                  <span className="muted">
                    {dateTime(h.verifiedAt)}
                    {h.failureReason ? `, ${h.failureReason}` : ''}
                  </span>
                </span>
                <Status value={h.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
