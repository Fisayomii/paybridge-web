import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../auth/AuthContext.jsx';
import { ErrorNote, Field } from '../components/ui.jsx';

export function AuthFrame({ children }) {
  return (
    <div className="auth">
      <section className="auth-side">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          PayBridge
        </div>
        <p className="auth-line">Naira wallets, bank payouts and money from abroad, in one ledger.</p>
      </section>
      <section className="auth-main">{children}</section>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(form.email.trim(), form.password);
      navigate(homeFor(user.role), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <form className="auth-form" onSubmit={submit}>
        <h1>Log in</h1>
        <Field label="Email">
          <input
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <ErrorNote error={error} />
        <button className="btn btn-primary btn-wide" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <p className="muted">
          New to PayBridge? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </AuthFrame>
  );
}
