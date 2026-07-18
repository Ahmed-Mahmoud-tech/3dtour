import mongoose from 'mongoose';

/**
 * Ownership ledger for uploaded media files.
 *
 * Uploads land in a flat `uploads/{type}/` directory with timestamp-random
 * names and no per-project record — so nothing stopped a staff member from
 * pasting another tour's media URL onto their own project (then triggering its
 * deletion on "replace"). This ledger binds each URL to the first project that
 * references it: once bound, another project trying to attach the same URL is
 * rejected (see utils/mediaBinding.js).
 *
 * `project` null = uploaded but not yet attached to any tour.
 * `shared` true = referenced by multiple tours at backfill time (legacy demo
 *   media reused across tours) — never gate these, they predate the ledger.
 */
const uploadSchema = new mongoose.Schema(
  {
    // Public '/uploads/...' URL — the identity of the file.
    url: { type: String, required: true, unique: true },
    // Bound owner tour; null until first attached.
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    // Whoever first attached/uploaded it (audit only).
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    shared: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Upload', uploadSchema);
