import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server .env or root .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const connectDB = async () => {
  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.VITE_DATABASE_URL ||
    "mongodb+srv://tursunboyevakbarali807_db_user:C3XjuhqwsYHXz0B0@cluster0.qrz3eap.mongodb.net/?appName=Cluster0";

  try {
    await mongoose.connect(dbUrl);
    console.log("✅ MongoDB ga muvaffaqiyatli ulandi");
  } catch (err) {
    console.error("❌ MongoDB ulanish xatosi:", err.message);
  }
};
