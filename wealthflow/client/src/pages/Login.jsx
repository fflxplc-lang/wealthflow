import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { api, setToken } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../ui.jsx';

export default function Login() {
  const { setUser } = useAuth();
  const toast = useToast();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await api.post('/auth/login', { login, password });
      setToken(r.token);
      setUser(r.user);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const recover = async () => {
    if (!login) { setError('Enter your ID or email first, then press Recovery.'); return; }
    const r = await api.post('/auth/recover', { login });
    toast(r.message);
  };

  return (
    <div className="login-page">
      <Logo size="lg" />
      <div className="login-tag">XPERIENCE THE POWER OF LIFEX</div>
      <form className="login-card col gap-lg" onSubmit={submit}>
        <div className="center">
          <h2>Sign In</h2>
          <p className="muted mt-sm">Authorized Access Only</p>
        </div>
        <label className="field">
          <span className="field-label">Employee ID or Email</span>
          <div className="input-icon"><Mail size={17} /><input className="input" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="ID or registered email" autoFocus /></div>
        </label>
        <label className="field">
          <span className="row between"><span className="field-label">Password</span>
            <button type="button" onClick={recover} className="btn-ghost" style={{ border: 0, background: 'none', color: 'var(--blue)', fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', cursor: 'pointer' }}>RECOVERY?</button></span>
          <div className="input-icon" style={{ position: 'relative' }}>
            <Lock size={17} />
            <input className="input" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            <button type="button" className="icon-btn" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }} onClick={() => setShow(!show)}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
        </label>
        {error && <div className="banner red">{error}</div>}
        <button className="login-btn" disabled={busy}>{busy ? 'Verifying…' : 'Secure Access'} <ArrowRight size={17} /></button>
      </form>
    </div>
  );
}
