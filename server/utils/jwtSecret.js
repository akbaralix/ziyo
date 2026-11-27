import crypto from "node:crypto";

// Read signing secret from environment or generate an ephemeral per-boot CSPRNG secret
export const JWT_SECRET =
  process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0
    ? process.env.JWT_SECRET.trim()
    : crypto.randomBytes(32).toString("hex");
