import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fundings, wallets } from '../api/endpoints.js';
import { Amount, Balance, Empty, ErrorNote, Loading, PageHead, Status } from '../components/ui.jsx';
import { dateTime, money } from '../lib/format.js';

const PAGE_SIZE = 30;

export default function WalletDetail() {
  const { walletNumber } = useParams();
  const [page, setPage] = useState(0);

  const wallet = useQuery({ queryKey: ['wallet', walletNumber], queryFn: () => wallets.get(walletNumber) });
  const statement = useQuery({
    queryKey: ['statement', walletNumber, page],
    queryFn: () => wallets.statement(walletNumber, page, PAGE_SIZE),
    placeholderData: (prev) => prev,
  });
  const topUps = useQuery({ queryKey: ['fundings', walletNumber], queryFn: () => fundings.list(walletNumber, 0, 5) });

  const w = wallet.data;
  const entries = statement.data ?? [];

  return (
    <div className="page">
      <PageHead title={w ? `${w.currency} wallet ${w.walletNumber}` : 'Wallet'}>
        <Link className="btn btn-line" to="/add-money">
          Add money
        </Link>
      </PageHead>
      <ErrorNote error={wallet.error} />
      {w && (
        <div className="summary-line">
          <Balance amount={w.balance} currency={w.currency} />
          <Status value={w.status} />
        </div>
      )}

      <section className="block">
        <h2>Statement</h2>
        {statement.isLoading && <Loading />}
        <ErrorNote error={statement.error} />
        {statement.data && entries.length === 0 && page === 0 && (
          <Empty>Nothing has moved in or out of this wallet yet.</Empty>
        )}
        {entries.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th className="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap">{dateTime(e.createdAt)}</td>
                    <td>{e.narration}</td>
                    <td className="num muted small">{e.transactionReference}</td>
                    <td className="right">
                      <Amount value={e.amount} currency={e.currency} direction={e.entryType} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* The statement endpoint returns a plain list, so "older" is offered while pages are full. */}
        {(page > 0 || entries.length === PAGE_SIZE) && (
          <div className="pager">
            <button className="btn btn-quiet" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Newer
            </button>
            <span className="muted">Page {page + 1}</span>
            <button
              className="btn btn-quiet"
              disabled={entries.length < PAGE_SIZE}
              onClick={() => setPage(page + 1)}
            >
              Older
            </button>
          </div>
        )}
      </section>

      <section className="block">
        <h2>Recent top-ups</h2>
        <ErrorNote error={topUps.error} />
        {topUps.data?.length === 0 && <Empty>No top-ups yet.</Empty>}
        {topUps.data?.length > 0 && (
          <ul className="rows">
            {topUps.data.map((f) => (
              <li key={f.reference} className="row">
                <span className="row-main">
                  <strong>{f.channel === 'ADMIN_ADJUSTMENT' ? 'Adjustment by PayBridge' : 'Card or bank top-up'}</strong>
                  <span className="muted">
                    {f.reference}, {dateTime(f.createdAt)}
                  </span>
                </span>
                <span className="row-end">
                  <span className="num">{money(f.amount, f.currency)}</span>
                  <Status value={f.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
