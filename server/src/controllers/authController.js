import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/register
// Bootstrap only: creates the first platform admin when the users collection
// is empty. Once any user exists, accounts are created via /api/admin/owners.
export const register = async (req, res) => {
  try {
    const userCount = await User.estimatedDocumentCount();
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
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Strings only — an object here would become a MongoDB query operator
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    if (user.status === 'suspended')
      return res.status(403).json({ message: 'Account suspended' });

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user._id);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  res.json(req.user);
};

// PUT /api/auth/password
// Self-service password change for any authenticated user (admin or owner).
export const changePassword = async (req, res) => {
  try {
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

    user.password = newPassword; // pre-save hook re-hashes
    user.mustChangePassword = false;
    await user.save();

    res.json({ message: 'Password updated', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
