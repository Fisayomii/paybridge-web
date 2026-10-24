import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { transfers } from '../api/endpoints.js';
import { pageOf } from '../api/client.js';
import { Empty, ErrorNote, Loading, PageHead, Pager, Status } from '../components/ui.jsx';
import { useBanks } from '../lib/banks.js';
import { dateTime, money } from '../lib/format.js';

export default function Transfers() {
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  const { nameOf } = useBanks();
  const q = useQuery({
    queryKey: ['transfers', page, 20],
    queryFn: () => transfers.list(page, 20),
    placeholderData: (prev) => prev,
  });
  const p = q.data ? pageOf(q.data) : null;

  return (
    <div className="page">
      <PageHead title="Transfers">
        <Link className="btn btn-primary" to="/send">
          Send money
        </Link>
      </PageHead>
      <p className="muted">Money you have sent. Money you received is on your wallet statement.</p>
      {q.isLoading && <Loading />}
      <ErrorNote error={q.error} />
      {p && p.items.length === 0 && <Empty>You haven't sent any money yet.</Empty>}
      {p && p.items.length > 0 && (
        <div className="table-wrap">
          <table className="table table-click">
            <thead>
              <tr>
                <th className="hide-sm">Date</th>
                <th>To</th>
                <th className="hide-sm">Description</th>
                <th>Status</th>
                <th className="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {p.items.map((t) => (
                <tr key={t.reference} onClick={() => navigate(`/transfers/${t.reference}`)}>
                  <td className="nowrap hide-sm">{dateTime(t.createdAt)}</td>
                  <td>
                    <Link to={`/transfers/${t.reference}`}>{t.beneficiaryName || t.destinationWalletNumber}</Link>
                    <div className="muted small">
                      {t.type === 'EXTERNAL'
                        ? `${nameOf(t.beneficiaryBankCode)} ${t.beneficiaryAccountNumber}`
                        : `Wallet ${t.destinationWalletNumber}`}
                    </div>
                    <div className="muted small show-sm">{dateTime(t.createdAt)}</div>
                  </td>
                  <td className="hide-sm">{t.narration}</td>
                  <td>
                    <Status value={t.status} />
                  </td>
                  <td className="right num">{money(t.totalDebit, t.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {p && <Pager page={p.page} totalPages={p.totalPages} onChange={setPage} />}
    </div>
  );
}
