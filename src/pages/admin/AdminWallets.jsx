import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { admin } from '../../api/endpoints.js';
import { pageOf } from '../../api/client.js';
import ActionDialog from '../../components/ActionDialog.jsx';
import { ErrorNote, Loading, PageHead, Pager, Status } from '../../components/ui.jsx';
import { money, newKey, titleCase } from '../../lib/format.js';

const REFRESH = [['admin-wallets']];

export default function AdminWallets() {
  const [page, setPage] = useState(0);
  const [action, setAction] = useState(null);
  const q = useQuery({
    queryKey: ['admin-wallets', page],
    queryFn: () => admin.wallets(page, 50),
    placeholderData: (prev) => prev,
  });
  const p = q.data ? pageOf(q.data) : null;

  const changeStatus = (w) => ({
    title: `Status of wallet ${w.walletNumber}`,
    description:
      'Post-no-debit: money can come in but not go out. Frozen: nothing moves except refunds and reversals.',
    fields: [
      {
        name: 'status',
        label: 'New status',
        type: 'select',
        initial: w.status === 'ACTIVE' ? 'FROZEN' : 'ACTIVE',
        options: ['ACTIVE', 'POST_NO_DEBIT', 'FROZEN'].map((s) => ({ value: s, label: titleCase(s) })),
      },
      { name: 'reason', label: 'Reason', type: 'textarea', hint: 'e.g. Suspected account takeover, ticket OPS-1234' },
    ],
    submitLabel: 'Change status',
    run: (v) => admin.setWalletStatus(w.walletNumber, v.status, v.reason),
    invalidate: REFRESH,
  });

  const adjust = (w) => {
    const key = newKey('adj'); // one key per dialog, so a double click can't credit twice
    return {
      title: `Adjust wallet ${w.walletNumber}`,
      description: `${w.ownerName}. Current balance ${money(w.balance, w.currency)}. Posted against the adjustments ledger and audited.`,
      fields: [
        {
          name: 'direction',
          label: 'Direction',
          type: 'select',
          initial: 'CREDIT',
          options: [
            { value: 'CREDIT', label: 'Credit (add money)' },
            { value: 'DEBIT', label: 'Debit (take money)' },
          ],
        },
        { name: 'amount', label: `Amount (${w.currency})`, inputMode: 'decimal' },
        { name: 'reason', label: 'Reason', type: 'textarea', hint: 'e.g. Sandbox test funds, ticket OPS-7' },
      ],
      submitLabel: 'Post adjustment',
      run: (v) => admin.adjust(w.walletNumber, { direction: v.direction, amount: Number(v.amount).toFixed(2), reason: v.reason }, key),
      invalidate: REFRESH,
    };
  };

  return (
    <div className="page">
      <PageHead title="Wallets" />
      {q.isLoading && <Loading />}
      <ErrorNote error={q.error} />
      {p && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Wallet</th>
                <th>Owner</th>
                <th>Status</th>
                <th className="right">Balance</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {p.items.map((w) => (
                <tr key={w.walletNumber}>
                  <td className="num">
                    {w.walletNumber}
                    <div className="muted small">{w.currency}</div>
                  </td>
                  <td>
                    {w.ownerName}
                    <div className="muted small">{w.email}</div>
                  </td>
                  <td>
                    <Status value={w.status} />
                  </td>
                  <td className="right num">{money(w.balance, w.currency)}</td>
                  <td className="row-actions">
                    <button className="btn btn-quiet btn-small" onClick={() => setAction(adjust(w))}>
                      Adjust
                    </button>
                    <button className="btn btn-quiet btn-small" onClick={() => setAction(changeStatus(w))}>
                      Change status
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {p && <Pager page={p.page} totalPages={p.totalPages} onChange={setPage} />}
      <ActionDialog action={action} onClose={() => setAction(null)} />
    </div>
  );
}
