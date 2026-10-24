import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, audit } from '../db.js';
import { sign, requireAuth, teamOf } from '../auth.js';

const r = Router();

// Accepts an employee/ARN code or the registered email.
r.post('/login', (req, res) => {
  const { login = '', password = '' } = req.body || {};
  const id = login.trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = ? OR lower(code) = ?').get(id, id);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    audit(null, 'LOGIN_FAILED', `Failed sign-in for "${login}"`);
    return res.status(401).json({ error: 'Invalid ID or password' });
  }
  if (!user.active) return res.status(403).json({ error: 'This account is disabled' });
  audit(user, 'LOGIN', `${user.name} signed in`);
  res.json({ token: sign(user), user: { ...publicUser(user), team: teamOf(user) } });
});

r.get('/me', requireAuth, (req, res) => {
  const me = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ ...publicUser(me), team: teamOf(me) });
});

r.post('/logout', requireAuth, (req, res) => {
  audit(req.user, 'LOGOUT', `${req.user.name} signed out`);
  res.json({ ok: true });
});

// Recovery: no mail server is configured, so a request is logged for the admin to act on.
r.post('/recover', (req, res) => {
  const { login = '' } = req.body || {};
  audit(null, 'PASSWORD_RECOVERY', `Password recovery requested for "${login}"`);
  db.prepare('INSERT INTO notifications(title, body) VALUES(?, ?)').run('Password recovery', `Recovery requested for ${login}`);
  res.json({ ok: true, message: 'Your administrator has been notified to reset your password.' });
});

export function publicUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  for (const k of ['bank', 'address', 'extra_levels', 'custom_split']) {
    try { rest[k] = rest[k] ? JSON.parse(rest[k]) : null; } catch { rest[k] = null; }
  }
  return rest;
}

export default r;
