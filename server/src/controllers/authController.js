import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/register
// Bootstrap only: creates the first platform admin when the users collection
// is empty. Once any user exists, accounts are created via /api/admin/owners.
export const register = asyncHandler(async (req, res) => {
  // countDocuments (not estimatedDocumentCount): this gate decides who can
  // become platform admin — metadata-based estimates can be stale after an
  // unclean shutdown.
  const userCount = await User.countDocuments();
  if (userCount > 0)
    return res
      .status(403)
      .json({ message: 'Registration is disabled. Accounts are created by the administrator.' });

  const { name, email, password } = req.body;

  if ([name, email, password].some((f) => typeof f !== 'string' || !f.trim()))
    return res.status(400).json({ message: 'Name, email and password are required' });

  if (password.length < 8)
    return res.status(400).json({ message: 'Password must be at least 8 characters' });

  const user = await User.create({ name, email, password, role: 'admin' });
  const token = signToken(user._id);

  res.status(201).json({ token, user });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Strings only — an object here would become a MongoDB query operator
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password)
    return res.status(400).json({ message: 'Email and password are required' });

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !(await user.comparePassword(password)))
    return res.status(401).json({ message: 'Invalid credentials' });

  if (user.status === 'suspended')
    return res.status(403).json({ message: 'Account suspended' });

  // Targeted update — a full save() would re-run validation and hooks
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

  const token = signToken(user._id);
  res.json({ token, user });
});

// GET /api/auth/me
export const getMe = async (req, res) => {
  res.json(req.user);
};

// PUT /api/auth/password
// Self-service password change for any authenticated user (admin, employee or owner).
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' ||
      !currentPassword || !newPassword)
    return res.status(400).json({ message: 'Current and new password are required' });

  if (newPassword.length < 8)
    return res.status(400).json({ message: 'Password must be at least 8 characters' });

  // req.user was loaded without the password hash — re-fetch with it.
  const user = await User.findById(req.user._id);
  if (!(await user.comparePassword(currentPassword)))
    return res.status(401).json({ message: 'Current password is incorrect' });

  user.password = newPassword; // pre-save hook re-hashes + stamps passwordChangedAt
  user.mustChangePassword = false;
  await user.save();

  // The change invalidates every existing token for this user (including the
  // one on this request) — hand back a fresh one so the session continues.
  res.json({ message: 'Password updated', user, token: signToken(user._id) });
});
