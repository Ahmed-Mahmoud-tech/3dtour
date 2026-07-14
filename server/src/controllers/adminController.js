import mongoose from 'mongoose';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import Project from '../models/Project.js';

const addToPlan = (from, plan) => {
  const d = new Date(from);
  if (plan === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
};

// POST /api/admin/owners
// Creates a tour-owner account with an admin-assigned password, and
// optionally its subscription in the same call.
export const createOwner = async (req, res) => {
  try {
    const { name, email, password, plan } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required' });
    if (password.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const owner = await User.create({
      name,
      email,
      password,
      role: 'owner',
      createdBy: req.user._id,
      mustChangePassword: true,
    });

    let subscription = null;
    if (plan) {
      const startedAt = new Date();
      subscription = await Subscription.create({
        owner: owner._id,
        plan,
        startedAt,
        expiresAt: addToPlan(startedAt, plan),
        history: [{ action: 'created', plan, by: req.user._id }],
      });
    }

    res.status(201).json({ owner, subscription });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/owners
// Lists owners with their subscription and assigned tours.
export const listOwners = async (req, res) => {
  try {
    const owners = await User.find({ role: 'owner' }).sort({ createdAt: -1 }).lean();
    const ownerIds = owners.map((o) => o._id);

    const [subscriptions, projects] = await Promise.all([
      Subscription.find({ owner: { $in: ownerIds } }).lean(),
      Project.find({ owner: { $in: ownerIds } }).select('info.title owner').lean(),
    ]);

    const subsByOwner = new Map(
      subscriptions.map((s) => [
        String(s.owner),
        { ...s, isActive: s.status === 'active' && s.expiresAt > new Date() },
      ])
    );
    const toursByOwner = new Map();
    for (const p of projects) {
      const key = String(p.owner);
      if (!toursByOwner.has(key)) toursByOwner.set(key, []);
      toursByOwner.get(key).push({ _id: p._id, title: p.info?.title || 'Untitled' });
    }

    res.json(
      owners.map((o) => ({
        ...o,
        subscription: subsByOwner.get(String(o._id)) || null,
        tours: toursByOwner.get(String(o._id)) || [],
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/admin/owners/:id  — update name/email/status
export const updateOwner = async (req, res) => {
  try {
    const owner = await User.findOne({ _id: req.params.id, role: 'owner' });
    if (!owner) return res.status(404).json({ message: 'Owner not found' });

    const { name, email, status } = req.body;
    if (name) owner.name = name;
    if (email) owner.email = email;
    if (status && ['active', 'suspended'].includes(status)) owner.status = status;

    await owner.save();
    res.json(owner);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Email already registered' });
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/admin/owners/:id/password  — assign a new temporary password
export const resetOwnerPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters' });

    const owner = await User.findOne({ _id: req.params.id, role: 'owner' });
    if (!owner) return res.status(404).json({ message: 'Owner not found' });

    owner.password = password; // pre-save hook re-hashes
    owner.mustChangePassword = true;
    await owner.save();

    res.json({ message: 'Password reset', owner });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/admin/owners/:id
// Removes the account + subscription; assigned tours become unassigned.
export const deleteOwner = async (req, res) => {
  try {
    const owner = await User.findOne({ _id: req.params.id, role: 'owner' });
    if (!owner) return res.status(404).json({ message: 'Owner not found' });

    await Promise.all([
      Project.updateMany({ owner: owner._id }, { $set: { owner: null } }),
      Subscription.deleteOne({ owner: owner._id }),
      owner.deleteOne(),
    ]);

    res.json({ message: 'Owner deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/admin/owners/:id/subscription
// Creates the subscription, or renews / changes plan if one exists.
// Body: { plan: 'monthly'|'yearly', expiresAt? } — expiresAt overrides the
// computed period end when the admin wants a custom date.
export const upsertSubscription = async (req, res) => {
  try {
    const { plan, expiresAt } = req.body;
    if (!['monthly', 'yearly'].includes(plan))
      return res.status(400).json({ message: 'plan must be monthly or yearly' });

    const owner = await User.findOne({ _id: req.params.id, role: 'owner' });
    if (!owner) return res.status(404).json({ message: 'Owner not found' });

    let sub = await Subscription.findOne({ owner: owner._id });

    if (!sub) {
      const startedAt = new Date();
      sub = await Subscription.create({
        owner: owner._id,
        plan,
        startedAt,
        expiresAt: expiresAt ? new Date(expiresAt) : addToPlan(startedAt, plan),
        history: [{ action: 'created', plan, by: req.user._id }],
      });
      return res.status(201).json(sub);
    }

    const planChanged = sub.plan !== plan;
    // Renewals extend from the current expiry if still active, else from now.
    const base = sub.expiresAt > new Date() && sub.status === 'active' ? sub.expiresAt : new Date();
    sub.plan = plan;
    sub.status = 'active';
    sub.expiresAt = expiresAt ? new Date(expiresAt) : addToPlan(base, plan);
    sub.history.push({
      action: planChanged ? 'plan_changed' : 'renewed',
      plan,
      expiresAt: sub.expiresAt,
      by: req.user._id,
    });
    await sub.save();
    res.json(sub);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/admin/owners/:id/subscription  — cancel or reactivate
export const setSubscriptionStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'canceled'].includes(status))
      return res.status(400).json({ message: 'status must be active or canceled' });

    const sub = await Subscription.findOne({ owner: req.params.id });
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });

    sub.status = status;
    sub.history.push({
      action: status === 'canceled' ? 'canceled' : 'reactivated',
      by: req.user._id,
    });
    await sub.save();
    res.json(sub);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/admin/projects/:id/assign  — body: { ownerId: string | null }
export const assignProjectOwner = async (req, res) => {
  try {
    const { ownerId } = req.body;

    if (ownerId) {
      if (!mongoose.isValidObjectId(ownerId))
        return res.status(400).json({ message: 'Invalid ownerId' });
      const owner = await User.findOne({ _id: ownerId, role: 'owner' });
      if (!owner) return res.status(404).json({ message: 'Owner not found' });
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: { owner: ownerId || null } },
      { new: true }
    ).select('info.title owner');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
