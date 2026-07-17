import mongoose from "mongoose";

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const Position2DSchema = new mongoose.Schema(
  {
    x_deg: { type: Number, required: true, min: 0, max: 360 },
    y_deg: { type: Number, required: true, min: 0, max: 360 },
  },
  { _id: false },
);

const ScaleSchema = new mongoose.Schema(
  {
    width: { type: Number, default: 1.0 },
    height: { type: Number, default: 1.0 },
  },
  { _id: false },
);

const TransitionVideoItemSchema = new mongoose.Schema(
  {
    videoUrl: { type: String, default: "" },
    yawOffset: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    transitionId: { type: String, default: "" },
    // The node this segment departs FROM (for multi-hop chains). The segment's
    // destination is the next video's startNodeId, or the hotspot's targetNodeId
    // for the last video in the chain.
    startNodeId: { type: String, default: "" },
  },
  { _id: false },
);

const NavigationHotspotSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    iconType: { type: String, default: "arrow_dynamic" },
    // Footprint marker tint (ring, fill, feet, pulse)
    color: { type: String, default: "#ffffff" },
    position2D: { type: Position2DSchema, required: true },
    scale: { type: ScaleSchema, default: () => ({}) },
    targetNodeId: { type: String, required: true },
    transitionId: { type: String, default: "" },
    transitionVideoUrl: { type: String, default: "" },
    videoInitialYawOffset: { type: Number, default: 0 },
    // Multi-video support: array of videos that play sequentially
    transitionVideos: { type: [TransitionVideoItemSchema], default: [] },
  },
  { _id: false },
);

const PopupContentSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    htmlContent: { type: String, default: "" },
  },
  { _id: false },
);

const AppearanceSchema = new mongoose.Schema(
  {
    renderType: {
      type: String,
      enum: ["icon", "image", "text"],
      default: "icon",
    },
    assetUrl: { type: String, default: "FaInfoCircle" },
    iconColor: { type: String, default: "#ffffff" },
    // Badge (sign body) base color — gradient/glow are derived from it
    color: { type: String, default: "#10c9b7" },
  },
  { _id: false },
);

const InfoSignSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    position2D: { type: Position2DSchema, required: true },
    scale: { type: ScaleSchema, default: () => ({}) },
    appearance: { type: AppearanceSchema, default: () => ({}) },
    popupContent: { type: PopupContentSchema, default: () => ({}) },
  },
  { _id: false },
);

const NodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    displayName: { type: String, required: true },
    panoramaUrl: { type: String, required: true },
    // Low-res preview generated at upload; the viewer shows it instantly and
    // swaps in the full panorama once decoded (blur-up)
    panoramaPreviewUrl: { type: String, default: "" },
    initialYawOffset: { type: Number, default: 0 },
    navigationHotspots: { type: [NavigationHotspotSchema], default: [] },
    infoSigns: { type: [InfoSignSchema], default: [] },
  },
  { _id: false },
);

const TransitionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    videoUrl: { type: String, required: true },
  },
  { _id: false },
);

const GlobalBackgroundAudioSchema = new mongoose.Schema(
  {
    src: { type: String, default: "" },
    defaultVolume: { type: Number, default: 0.4, min: 0, max: 1 },
    allowMute: { type: Boolean, default: true },
  },
  { _id: false },
);

// ─── Root Project Schema ───────────────────────────────────────────────────────

const ProjectSchema = new mongoose.Schema(
  {
    info: {
      title: { type: String, required: true, trim: true },
      author: { type: String, default: "" },
      // Client's logo shown on the nadir patch (bottom of every sphere).
      // Empty string → viewer falls back to the default Gateverse logo.
      nadirLogoUrl: { type: String, default: "" },
    },
    settings: {
      initialNodeId: { type: String, default: "" },
      globalBackgroundAudio: {
        type: GlobalBackgroundAudioSchema,
        default: () => ({}),
      },
    },
    // nodes and transitions are stored as Map so field keys are dynamic node IDs
    nodes: {
      type: Map,
      of: NodeSchema,
      default: () => new Map(),
    },
    transitions: {
      type: Map,
      of: TransitionSchema,
      default: () => new Map(),
    },
    // The admin who built the tour in the studio.
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // The client (role 'owner') this tour is assigned to. Drives dashboard
    // access and subscription gating of the public route. null = unassigned
    // (admin-internal tour, never gated).
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    // Admin kill-switch: a suspended tour's public route returns 403
    // regardless of expiry mode or subscription state.
    suspended: { type: Boolean, default: false },
    // How the public route decides the tour has expired:
    //  - 'subscription' (default): owner's subscription expiry + 3-month grace
    //  - 'date': blocked after an admin-chosen fixed date
    //  - 'lifetime': never expires
    expiry: {
      mode: {
        type: String,
        enum: ["subscription", "date", "lifetime"],
        default: "subscription",
      },
      date: { type: Date, default: null },
    },
    // The staff member (role 'employee') assigned to build/maintain this tour.
    // Scopes what that employee can see and edit in the studio. null = unassigned.
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    // Return Maps as plain objects in JSON
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        if (ret.nodes instanceof Map) ret.nodes = Object.fromEntries(ret.nodes);
        if (ret.transitions instanceof Map)
          ret.transitions = Object.fromEntries(ret.transitions);
        return ret;
      },
    },
  },
);

export default mongoose.model("Project", ProjectSchema);
