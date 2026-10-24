import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const NAV = {
  CUSTOMER: [
    { to: '/', label: 'Home', end: true },
    { to: '/send', label: 'Send money' },
    { to: '/add-money', label: 'Add money' },
    { to: '/transfers', label: 'Transfers' },
    { to: '/beneficiaries', label: 'Saved recipients' },
    { to: '/verify', label: 'Verify identity' },
  ],
  PARTNER: [{ to: '/partner', label: 'Remittances' }],
  ADMIN: [
    { to: '/admin', label: 'Customers', end: true },
    { to: '/admin/wallets', label: 'Wallets' },
    { to: '/admin/reviews', label: 'Review queue' },
    { to: '/admin/settlement', label: 'Settlement' },
  ],
};

const ROLE_NAME = { CUSTOMER: 'Personal', PARTNER: 'Partner', ADMIN: 'Operations' };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = NAV[user?.role] ?? [];

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          PayBridge
          <span className="brand-role">{ROLE_NAME[user?.role]}</span>
        </div>
        <nav className="rail-nav" aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="rail-foot">
          <div className="rail-user">
            <strong>{user?.fullName}</strong>
            <span>{user?.email}</span>
          </div>
          <button className="rail-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="content">
        <SlowServerNotice />
        <Outlet />
      </main>
    </div>
  );
}

// Render's free backend sleeps after 15 idle minutes; the first call can take ~50 seconds.
function SlowServerNotice() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const onSlow = (e) => setSlow(e.detail);
    window.addEventListener('pb:slow', onSlow);
    return () => window.removeEventListener('pb:slow', onSlow);
  }, []);
  if (!slow) return null;
  return (
    <div className="notice notice-wait" role="status">
      The server is waking up. This can take up to a minute on the first request.
    </div>
  );
}
