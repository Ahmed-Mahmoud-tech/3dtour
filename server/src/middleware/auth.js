import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Verifies the JWT from the Authorization header.
 * Attaches the decoded user object to req.user on success.
 * Role/status are re-read from the DB on every request, so suspensions
 * and role changes take effect immediately regardless of token contents.
 * Tokens minted before the user's last password change are rejected, so a
 * password reset kills any stolen sessions immediately.
 */
export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    if (req.user.status === 'suspended')
      return res.status(403).json({ message: 'Account suspended' });
    // iat is in seconds (floored) — the 1s slack keeps the token issued in
    // the same request that changed the password valid.
    if (
      req.user.passwordChangedAt &&
      decoded.iat * 1000 < req.user.passwordChangedAt.getTime() - 1000
    ) {
      return res.status(401).json({ message: 'Session expired, please log in again' });
    }
    next();
  } catch {
    return res.status(401).json({ message: 'Not authorized, token invalid or expired' });
  }
};

/** Allows only platform admins past this point. Must run after protect. */
export const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

/** Allows only the given roles past this point. Must run after protect. */
export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  next();
};
