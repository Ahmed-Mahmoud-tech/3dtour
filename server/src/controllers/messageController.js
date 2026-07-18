import mongoose from 'mongoose';
import Message from '../models/Message.js';
import Project from '../models/Project.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// POST /api/messages/:tourId  (public, rate-limited)
// Body validated by validateBody(submitMessageSchema): { name, email?, message, nodeId? }
export const submitMessage = asyncHandler(async (req, res) => {
  const { tourId } = req.params;
  if (!mongoose.isValidObjectId(tourId))
    return res.status(400).json({ message: 'Bad tour id' });

  const { name, email = '', message, nodeId = '' } = req.body;

  const project = await Project.findById(tourId).select('_id').lean();
  if (!project) return res.status(404).json({ message: 'Tour not found' });

  await Message.create({ tourId, name, email, body: message, nodeId });
  res.status(201).json({ ok: true });
});

// ─── Owner inbox (behind protect + canAccessTour, req.project attached) ───────

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/dashboard/:tourId/messages?page=1&limit=10&q=...
// q searches sender name, email and message text.
export const getMessages = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const filter = { tourId: req.project._id };
  if (req.query.q) {
    const rx = { $regex: escapeRegex(String(req.query.q).slice(0, 100)), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }, { body: rx }];
  }

  const [items, total, unread] = await Promise.all([
    Message.find(filter)
      // _id tiebreak keeps pagination stable when timestamps collide
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Message.countDocuments(filter),
    // Unread badge is global for the tour, not narrowed by the search
    Message.countDocuments({ tourId: req.project._id, read: false }),
  ]);

  res.json({ items, total, unread, page, pages: Math.max(Math.ceil(total / limit), 1) });
});

// PUT /api/dashboard/:tourId/messages/:messageId/read  Body: { read: boolean }
export const setMessageRead = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.messageId))
    return res.status(400).json({ message: 'Bad message id' });

  // Always scoped to the tour canAccessTour authorized — the id alone is
  // never trusted, so an owner can't touch another tour's messages.
  const msg = await Message.findOneAndUpdate(
    { _id: req.params.messageId, tourId: req.project._id },
    { $set: { read: req.body?.read !== false } },
    { new: true }
  ).lean();
  if (!msg) return res.status(404).json({ message: 'Message not found' });
  res.json(msg);
});

// DELETE /api/dashboard/:tourId/messages/:messageId
export const deleteMessage = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.messageId))
    return res.status(400).json({ message: 'Bad message id' });

  const result = await Message.deleteOne({
    _id: req.params.messageId,
    tourId: req.project._id,
  });
  if (result.deletedCount === 0)
    return res.status(404).json({ message: 'Message not found' });
  res.json({ ok: true });
});
