import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import Project from '../models/Project.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Request bodies here are validated by validateBody(...) at the route, so
// controllers trust the shape and only do business checks (uniqueness, etc.).

const addToPlan = (from, plan) => {
  const d = new Date(from);
  if (plan === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Shared list-query helpers: ?q searches name/email, ?page&limit paginate.
// Without `page` the caller gets the legacy full array.
const userSearchFilter = (role, q) => {
  const filter = { role };
  if (q) {
    const rx = { $regex: escapeRegex(String(q).slice(0, 100)), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }];
  }
  return filter;
};

const pageParams = (req, defLimit = 10) => ({
  paginated: req.query.page !== undefined,
  page: Math.max(parseInt(req.query.page, 10) || 1, 1),
  limit: Math.min(Math.max(parseInt(req.query.limit, 10) || defLimit, 1), 100),
});

// POST /api/admin/owners
// Creates a tour-owner account with an admin-assigned password.
// Subscriptions are per PROJECT, not per owner — they're created when a tour
// is sold, via POST /api/admin/projects/:id/subscription.
export const createOwner = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body; // validated + normalized

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

  res.status(201).json({ owner });
});

// GET /api/admin/owners?q&page&limit
// Lists owners with their assigned tours; each tour carries its own
// subscription (subscriptions are per project).
export const listOwners = asyncHandler(async (req, res) => {
  const filter = userSearchFilter('owner', req.query.q);
  const { paginated, page, limit } = pageParams(req);

  // .lean() bypasses the model's toJSON, so exclude the hash explicitly
  let query = User.find(filter).select('-password').sort({ createdAt: -1 });
  if (paginated) query = query.skip((page - 1) * limit).limit(limit);
  const [owners, total] = await Promise.all([
    query.lean(),
    paginated ? User.countDocuments(filter) : Promise.resolve(0),
  ]);
  const ownerIds = owners.map((o) => o._id);

  const projects = await Project.find({ owner: { $in: ownerIds } })
    .select('info.title owner')
    .lean();
  const subscriptions = await Subscription.find({
    project: { $in: projects.map((p) => p._id) },
  }).lean();

  const subsByProject = new Map(
    subscriptions.map((s) => [
      String(s.project),
      { ...s, isActive: s.status === 'active' && s.expiresAt > new Date() },
    ])
  );
  const toursByOwner = new Map();
  for (const p of projects) {
    const key = String(p.owner);
    if (!toursByOwner.has(key)) toursByOwner.set(key, []);
    toursByOwner.get(key).push({
      _id: p._id,
      title: p.info?.title || 'Untitled',
      subscription: subsByProject.get(String(p._id)) || null,
    });
  }

  const items = owners.map((o) => ({
    ...o,
    tours: toursByOwner.get(String(o._id)) || [],
  }));

  if (!paginated) return res.json(items);
  res.json({ items, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
});

// PUT /api/admin/owners/:id  — update name/email/status
export const updateOwner = asyncHandler(async (req, res) => {
  const owner = await User.findOne({ _id: req.params.id, role: 'owner' });
  if (!owner) return res.status(404).json({ message: 'Owner not found' });

  const { name, email, status } = req.body; // all optional, validated
  if (name) owner.name = name;
  if (email) owner.email = email;
  if (status) owner.status = status;

  try {
    await owner.save();
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Email already registered' });
    throw err;
  }
  res.json(owner);
});

// PUT /api/admin/owners/:id/password  — assign a new temporary password
export const resetOwnerPassword = asyncHandler(async (req, res) => {
  const { password } = req.body; // validated min 8

  const owner = await User.findOne({ _id: req.params.id, role: 'owner' });
  if (!owner) return res.status(404).json({ message: 'Owner not found' });

  owner.password = password; // pre-save hook re-hashes + kills existing sessions
  owner.mustChangePassword = true;
  await owner.save();

  res.json({ message: 'Password reset', owner });
});

// DELETE /api/admin/owners/:id
// Removes the account; assigned tours become unassigned. Subscriptions stay
// with their projects (they're per project, not per owner).
export const deleteOwner = asyncHandler(async (req, res) => {
  const owner = await User.findOne({ _id: req.params.id, role: 'owner' });
  if (!owner) return res.status(404).json({ message: 'Owner not found' });

  await Promise.all([
    Project.updateMany({ owner: owner._id }, { $set: { owner: null } }),
    owner.deleteOne(),
  ]);

  res.json({ message: 'Owner deleted' });
});

// POST /api/admin/projects/:id/subscription
// Creates the project's subscription, or renews / changes plan if one exists.
// Body: { plan: 'monthly'|'yearly', expiresAt? } — expiresAt overrides the
// computed period end when the admin wants a custom date.
export const upsertSubscription = asyncHandler(async (req, res) => {
  const { plan, expiresAt } = req.body; // plan enum + parseable-or-absent expiresAt
  const customExpiry =
    expiresAt !== undefined && expiresAt !== null && expiresAt !== ''
      ? new Date(expiresAt)
      : null;

  const project = await Project.findById(req.params.id).select('_id');
  if (!project) return res.status(404).json({ message: 'Project not found' });

  let sub = await Subscription.findOne({ project: project._id });

  if (!sub) {
    const startedAt = new Date();
    sub = await Subscription.create({
      project: project._id,
      plan,
      startedAt,
      expiresAt: customExpiry || addToPlan(startedAt, plan),
      history: [{ action: 'created', plan, by: req.user._id }],
    });
    return res.status(201).json(sub);
  }

  const planChanged = sub.plan !== plan;
  // Renewals extend from the current expiry if still active, else from now.
  const base = sub.expiresAt > new Date() && sub.status === 'active' ? sub.expiresAt : new Date();
  sub.plan = plan;
  sub.status = 'active';
  sub.expiresAt = customExpiry || addToPlan(base, plan);
  sub.remindersSent = []; // new period → expiry reminders arm again
  sub.history.push({
    action: planChanged ? 'plan_changed' : 'renewed',
    plan,
    expiresAt: sub.expiresAt,
    by: req.user._id,
  });
  await sub.save();
  res.json(sub);
});

// PUT /api/admin/projects/:id/subscription  — cancel or reactivate
export const setSubscriptionStatus = asyncHandler(async (req, res) => {
  const { status } = req.body; // validated enum active|canceled

  const sub = await Subscription.findOne({ project: req.params.id });
  if (!sub) return res.status(404).json({ message: 'Subscription not found' });

  sub.status = status;
  if (status === 'active') sub.remindersSent = []; // reactivation re-arms reminders
  sub.history.push({
    action: status === 'canceled' ? 'canceled' : 'reactivated',
    by: req.user._id,
  });
  await sub.save();
  res.json(sub);
});

// ─── Employees ────────────────────────────────────────────────────────────────
// Staff accounts (role 'employee') that log into the admin app and can only
// see/edit the projects assigned to them.

// POST /api/admin/employees
export const createEmployee = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body; // validated + normalized

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ message: 'Email already registered' });

  const employee = await User.create({
    name,
    email,
    password,
    role: 'employee',
    createdBy: req.user._id,
  });

  res.status(201).json(employee);
});

// GET /api/admin/employees?q&page&limit
// Lists employees with the projects assigned to each.
export const listEmployees = asyncHandler(async (req, res) => {
  const filter = userSearchFilter('employee', req.query.q);
  const { paginated, page, limit } = pageParams(req);

  // .lean() bypasses the model's toJSON, so exclude the hash explicitly
  let query = User.find(filter).select('-password').sort({ createdAt: -1 });
  if (paginated) query = query.skip((page - 1) * limit).limit(limit);
  const [employees, total] = await Promise.all([
    query.lean(),
    paginated ? User.countDocuments(filter) : Promise.resolve(0),
  ]);
  const employeeIds = employees.map((e) => e._id);

  const projects = await Project.find({ assignedTo: { $in: employeeIds } })
    .select('info.title assignedTo')
    .lean();

  const projectsByEmployee = new Map();
  for (const p of projects) {
    const key = String(p.assignedTo);
    if (!projectsByEmployee.has(key)) projectsByEmployee.set(key, []);
    projectsByEmployee.get(key).push({ _id: p._id, title: p.info?.title || 'Untitled' });
  }

  const items = employees.map((e) => ({
    ...e,
    projects: projectsByEmployee.get(String(e._id)) || [],
  }));

  if (!paginated) return res.json(items);
  res.json({ items, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
});

// PUT /api/admin/employees/:id  — update name/email/status
export const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await User.findOne({ _id: req.params.id, role: 'employee' });
  if (!employee) return res.status(404).json({ message: 'Employee not found' });

  const { name, email, status } = req.body; // all optional, validated
  if (name) employee.name = name;
  if (email) employee.email = email;
  if (status) employee.status = status;

  try {
    await employee.save();
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Email already registered' });
    throw err;
  }
  res.json(employee);
});

// PUT /api/admin/employees/:id/password  — assign a new temporary password
export const resetEmployeePassword = asyncHandler(async (req, res) => {
  const { password } = req.body; // validated min 8

  const employee = await User.findOne({ _id: req.params.id, role: 'employee' });
  if (!employee) return res.status(404).json({ message: 'Employee not found' });

  employee.password = password; // pre-save hook re-hashes + kills existing sessions
  employee.mustChangePassword = true;
  await employee.save();

  res.json({ message: 'Password reset', employee });
});

// DELETE /api/admin/employees/:id
// Removes the account; their projects become unassigned.
export const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await User.findOne({ _id: req.params.id, role: 'employee' });
  if (!employee) return res.status(404).json({ message: 'Employee not found' });

  await Promise.all([
    Project.updateMany({ assignedTo: employee._id }, { $set: { assignedTo: null } }),
    employee.deleteOne(),
  ]);

  res.json({ message: 'Employee deleted' });
});

// PUT /api/admin/projects/:id/assign-employee  — body: { employeeId: string | null }
export const assignProjectEmployee = asyncHandler(async (req, res) => {
  const { employeeId } = req.body; // null | 24-hex ObjectId (validated)

  if (employeeId) {
    const employee = await User.findOne({ _id: employeeId, role: 'employee' });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
  }

  const project = await Project.findByIdAndUpdate(
    req.params.id,
    { $set: { assignedTo: employeeId } },
    { new: true }
  ).select('info.title assignedTo');
  if (!project) return res.status(404).json({ message: 'Project not found' });

  res.json(project);
});

// PUT /api/admin/projects/:id/access
// Body: { suspended?: boolean, expiryMode?: 'subscription'|'date'|'lifetime', expiryDate?: string }
// Suspension and expiry mode drive the public-route gating in
// projectController.getPublicProject; expiryDate is required for mode 'date'.
export const updateProjectAccess = asyncHandler(async (req, res) => {
  // Validated by projectAccessSchema: suspended is boolean|absent, expiryMode
  // is a valid enum|absent, and a 'date' mode is guaranteed a parseable date.
  const { suspended, expiryMode, expiryDate } = req.body;

  const project = await Project.findById(req.params.id).select(
    'info.title owner suspended expiry'
  );
  if (!project) return res.status(404).json({ message: 'Project not found' });

  if (suspended !== undefined) project.suspended = suspended;

  if (expiryMode !== undefined) {
    project.expiry =
      expiryMode === 'date'
        ? { mode: 'date', date: new Date(expiryDate) }
        : { mode: expiryMode, date: null };
  }

  await project.save();
  res.json(project);
});

// PUT /api/admin/projects/:id/assign  — body: { ownerId: string | null }
export const assignProjectOwner = asyncHandler(async (req, res) => {
  const { ownerId } = req.body; // null | 24-hex ObjectId (validated)

  if (ownerId) {
    const owner = await User.findOne({ _id: ownerId, role: 'owner' });
    if (!owner) return res.status(404).json({ message: 'Owner not found' });
  }

  const project = await Project.findByIdAndUpdate(
    req.params.id,
    { $set: { owner: ownerId } },
    { new: true }
  ).select('info.title owner');
  if (!project) return res.status(404).json({ message: 'Project not found' });

  res.json(project);
});
