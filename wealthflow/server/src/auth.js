import jwt from 'jsonwebtoken';
import { db } from './db.js';

const SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

export const sign = (user) => jwt.sign({ id: user.id }, SECRET, { expiresIn: '12h' });

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : req.query.token;
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    const { id } = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT id, name, email, code, role, level, active FROM users WHERE id = ?').get(id);
    if (!user || !user.active) return res.status(401).json({ error: 'Account disabled' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// Admins see everything; everyone else is scoped to their own earnings.
export const scopeUser = (req) => (req.user.role === 'admin' ? null : req.user.id);
