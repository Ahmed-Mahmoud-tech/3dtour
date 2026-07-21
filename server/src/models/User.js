import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 8 },
    // Contact phone (WhatsApp/mobile) — display/contact only, never a login.
    phone: { type: String, default: '', trim: true },
    // Preferred language for outgoing email (subscription reminders).
    // Defaults to Arabic: the client base is Egypt-first.
    language: { type: String, enum: ['ar', 'en'], default: 'ar' },
    // Street address of the client's venue, free text.
    address: { type: String, default: '', trim: true },
    // Map pin for the venue. Null when unset — {lat:0,lng:0} is a real place
    // (Gulf of Guinea), so it must not double as "no location".
    location: {
      type: {
        lat: { type: Number, min: -90, max: 90, required: true },
        lng: { type: Number, min: -180, max: 180, required: true },
      },
      default: null,
      _id: false,
    },
    // Internal admin-only notes about the client. Never shown to the owner.
    notes: { type: String, default: '', trim: true, maxlength: 2000 },
    // 'admin'    = platform admin (you): full control, admin studio, exports.
    // 'owner'    = tour owner (client): analytics dashboard + own password only.
    // 'employee' = staff member: admin studio, but only projects assigned to them.
    role: { type: String, enum: ['admin', 'owner', 'employee'], default: 'owner' },
    // The admin who created this owner/employee account (null for admins).
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Owners get an admin-assigned password and must replace it on first login.
    mustChangePassword: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    lastLoginAt: { type: Date, default: null },
    // Set on every password change/reset; protect() rejects JWTs minted
    // before it, so old sessions die the moment the password changes.
    passwordChangedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  if (!this.isNew) this.passwordChangedAt = new Date();
  next();
});

// Compare plain password with stored hash
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Never expose password in JSON responses
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// Fields the platform keeps *about* a client that the client must never read
// back. `notes` is staff shorthand ("haggles on price", "slow payer") — it is
// admin-only by definition, so it is stripped from every self-serve response.
const ADMIN_ONLY_FIELDS = ['notes'];

/**
 * The view a user gets of their OWN account (login, /me). Admin routes keep
 * using toJSON so the Clients page still sees everything.
 * Accepts a doc or a plain/lean object.
 */
export const selfView = (user) => {
  if (!user) return user;
  const obj = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  delete obj.password;
  for (const f of ADMIN_ONLY_FIELDS) delete obj[f];
  return obj;
};

export default mongoose.model('User', userSchema);
