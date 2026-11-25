import mongoose from "mongoose";

const visitLogSchema = new mongoose.Schema(
  {
    ipHash: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    path: {
      type: String,
      default: "/",
    },
    device: {
      type: String,
      enum: ["desktop", "mobile", "tablet", "other"],
      default: "desktop",
    },
    date: {
      type: String, // "YYYY-MM-DD"
      required: true,
      index: true,
    },
    hits: {
      type: Number,
      default: 1,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

visitLogSchema.index({ date: 1, ipHash: 1 }, { unique: true });
visitLogSchema.index({ createdAt: -1 });

export default mongoose.model("VisitLog", visitLogSchema);
