import mongoose from "mongoose";

const loginSessionSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tokenHash: {
      type: String,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    telegramId: {
      type: String,
      default: null,
    },
    telegramUsername: {
      type: String,
      default: "",
    },
    telegramFirstName: {
      type: String,
      default: "",
    },
    telegramLastName: {
      type: String,
      default: "",
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    isClaimed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-delete expired sessions from MongoDB
loginSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OTP = mongoose.model("OTP", loginSessionSchema);
export default OTP;
