import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, homeFor } from './auth/AuthContext.jsx';
import Layout from './components/Layout.jsx';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Overview from './pages/Overview.jsx';
import WalletDetail from './pages/WalletDetail.jsx';
import SendMoney from './pages/SendMoney.jsx';
import AddMoney from './pages/AddMoney.jsx';
import FundingComplete from './pages/FundingComplete.jsx';
import Transfers from './pages/Transfers.jsx';
import TransferDetail from './pages/TransferDetail.jsx';
import Beneficiaries from './pages/Beneficiaries.jsx';
import Verify from './pages/Verify.jsx';
import PartnerHome from './pages/partner/PartnerHome.jsx';
import AdminCustomers from './pages/admin/AdminCustomers.jsx';
import AdminWallets from './pages/admin/AdminWallets.jsx';
import AdminReviews from './pages/admin/AdminReviews.jsx';
import AdminSettlement from './pages/admin/AdminSettlement.jsx';

// Only lets a route render for the given roles; everyone else goes to their own home page.
function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  const customer = (el) => <RequireRole roles={['CUSTOMER']}>{el}</RequireRole>;
  const partnerOnly = (el) => <RequireRole roles={['PARTNER']}>{el}</RequireRole>;
  const adminOnly = (el) => <RequireRole roles={['ADMIN']}>{el}</RequireRole>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homeFor(user.role)} replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />

      <Route element={<Layout />}>
        <Route index element={customer(<Overview />)} />
        <Route path="wallets/:walletNumber" element={customer(<WalletDetail />)} />
        <Route path="send" element={customer(<SendMoney />)} />
        <Route path="add-money" element={customer(<AddMoney />)} />
        {/* Paystack sends the customer here after checkout (PAYBRIDGE_FUNDING_CALLBACK_URL). */}
        <Route path="add-money/complete" element={customer(<FundingComplete />)} />
        <Route path="transfers" element={customer(<Transfers />)} />
        <Route path="transfers/:reference" element={customer(<TransferDetail />)} />
        <Route path="beneficiaries" element={customer(<Beneficiaries />)} />
        <Route path="verify" element={customer(<Verify />)} />

        <Route path="partner" element={partnerOnly(<PartnerHome />)} />

        <Route path="admin" element={adminOnly(<AdminCustomers />)} />
        <Route path="admin/wallets" element={adminOnly(<AdminWallets />)} />
        <Route path="admin/reviews" element={adminOnly(<AdminReviews />)} />
        <Route path="admin/settlement" element={adminOnly(<AdminSettlement />)} />
      </Route>

      <Route path="*" element={<Navigate to={user ? homeFor(user.role) : '/login'} replace />} />
    </Routes>
  );
}
