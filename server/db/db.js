import "../utils/loadEnv.js";
import mongoose from "mongoose";

export const isDbConnected = () => mongoose.connection.readyState === 1;

export const connectDB = async () => {
  mongoose.set("bufferCommands", false);

  const dbUrl =
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL ||
    process.env.VITE_DATABASE_URL ||
    "mongodb://localhost/mock";

  const isMockLocal = dbUrl === "mongodb://localhost/mock";

  try {
    await mongoose.connect(dbUrl, {
      serverSelectionTimeoutMS: isMockLocal ? 1500 : 8000,
    });
    console.log("✅ MongoDB ga muvaffaqiyatli ulandi");
  } catch (err) {
    console.warn("MongoDB not connected — using in-memory fallback:", err.message);
  }
};
