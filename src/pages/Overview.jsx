import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { auth, transfers, wallets } from '../api/endpoints.js';
import { pageOf } from '../api/client.js';
import { updateCustomer } from '../auth/session.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Balance, Empty, ErrorNote, Loading, Status } from '../components/ui.jsx';
import { dateTime, money } from '../lib/format.js';
import CopyButton from '../components/CopyButton.jsx';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Overview() {
  const { user } = useAuth();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const c = await auth.me();
      updateCustomer(c); // keeps the KYC tier in the session up to date
      return c;
    },
  });
  const walletsQ = useQuery({ queryKey: ['wallets'], queryFn: wallets.list });
  const recent = useQuery({ queryKey: ['transfers', 0, 5], queryFn: () => transfers.list(0, 5) });

  const firstName = (me.data?.fullName ?? user?.fullName ?? '').split(' ')[0];
  const list = walletsQ.data ?? [];
  const main = list.find((w) => w.currency === 'NGN') ?? list[0];
  const others = list.filter((w) => w !== main);
  const tier = me.data?.kycTier ?? user?.kycTier;

  return (
    <div className="page">
      <p className="hello">
        {greeting()}, {firstName}
      </p>

      {walletsQ.isLoading && <Loading label="Loading your wallet" />}
      <ErrorNote error={walletsQ.error} />

      {main && (
        <section className="hero">
          <div className="hero-figures">
            <span className="hero-label">Available in your {main.currency} wallet</span>
            <Balance amount={main.balance} currency={main.currency} />
            <div className="hero-meta">
              <span>
                Wallet number <strong className="num">{main.walletNumber}</strong>
              </span>
              <CopyButton value={main.walletNumber} label="Copy wallet number" />
              {main.status !== 'ACTIVE' && <Status value={main.status} />}
            </div>
            <p className="muted small">
              Alerts for money in and out go to <strong>{main.email}</strong>
              {main.email?.endsWith('.local') ? ' (a .local address, so no emails are sent)' : ''}.
            </p>
          </div>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/send">
              Send money
            </Link>
            <Link className="btn btn-line" to="/add-money">
              Add money
            </Link>
            <Link className="btn btn-quiet" to={`/wallets/${main.walletNumber}`}>
              View statement
            </Link>
          </div>
        </section>
      )}

      {tier === 1 && (
        <Link to="/verify" className="nudge">
          <strong>You can send up to ₦50,000 a day.</strong> Verify your BVN to raise it to ₦200,000.
        </Link>
      )}

      {others.length > 0 && (
        <section className="block">
          <h2>Other wallets</h2>
          <ul className="wallet-list">
            {others.map((w) => (
              <li key={w.walletNumber}>
                <Link to={`/wallets/${w.walletNumber}`}>
                  <span>
                    {w.currency} wallet <span className="num muted">{w.walletNumber}</span>
                  </span>
                  <strong className="num">{money(w.balance, w.currency)}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="block">
        <div className="block-head">
          <h2>Recent transfers</h2>
          <Link to="/transfers">See all</Link>
        </div>
        {recent.isLoading && <Loading />}
        <ErrorNote error={recent.error} />
        {recent.data && <RecentList items={pageOf(recent.data).items} />}
      </section>
    </div>
  );
}

function RecentList({ items }) {
  if (items.length === 0) {
    return (
      <Empty>
        No transfers yet. <Link to="/add-money">Add money</Link> to your wallet, then{' '}
        <Link to="/send">send some</Link>.
      </Empty>
    );
  }
  return (
    <ul className="rows">
      {items.map((t) => (
        <li key={t.reference}>
          <Link to={`/transfers/${t.reference}`} className="row-link">
            <span className="row-main">
              <strong>{t.beneficiaryName || t.destinationWalletNumber || 'Recipient'}</strong>
              <span className="muted">
                {t.type === 'EXTERNAL' ? 'Bank transfer' : 'PayBridge wallet'}, {dateTime(t.createdAt)}
              </span>
            </span>
            <span className="row-end">
              <span className="num">−{money(t.totalDebit ?? t.amount, t.currency)}</span>
              <Status value={t.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
