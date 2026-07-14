import mongoose from 'mongoose';

/**
 * A message a tour visitor leaves for the tour owner (public submit from the
 * viewer, read from the owner dashboard). Kept out of the Project document —
 * same principle as analytics: the tour stays lightweight.
 */
const messageSchema = new mongoose.Schema(
  {
    tourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, maxlength: 200, default: '' },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    read: { type: Boolean, default: false },
    // Node the visitor was looking at when they wrote it (optional context)
    nodeId: { type: String, default: '' },
  },
  { timestamps: true }
);

// Inbox is always read newest-first per tour
messageSchema.index({ tourId: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;
