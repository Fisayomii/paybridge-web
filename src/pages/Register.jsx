import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ErrorNote, Field } from '../components/ui.jsx';
import { AuthFrame } from './Login.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (form.password.length < 10) {
      setError(new Error('Use at least 10 characters for your password.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(form.fullName.trim(), form.email.trim(), form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <form className="auth-form" onSubmit={submit}>
        <h1>Create your account</h1>
        <p className="muted">You get a naira wallet straight away. Verify your BVN later to raise your limits.</p>
        <Field label="Full name" hint="As it appears on your BVN">
          <input autoComplete="name" required value={form.fullName} onChange={set('fullName')} />
        </Field>
        <Field label="Email" hint="Debit and credit alerts are sent here">
          <input type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" hint="At least 10 characters, with letters and numbers">
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={form.password}
            onChange={set('password')}
          />
        </Field>
        <ErrorNote error={error} />
        <button className="btn btn-primary btn-wide" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="muted">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </AuthFrame>
  );
}
