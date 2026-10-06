import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "./.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { connectDB } from "./db/db.js";
import startBot from "./bot/bot.js";
import authRoutes from "./routes/authRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import ratingRoutes from "./routes/ratingRoutes.js";
import { initSocketIO } from "./socket/gameSocket.js";

const app = express();
const httpServer = createServer(app);

// Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Marshrutlar
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/rating", ratingRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Ziyo server is running 🚀" });
});

// Socket.IO ishga tushirish
initSocketIO(io);

await connectDB();

const PORT = process.env.PORT || process.env.VITE_PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server http://localhost:${PORT} da ishlayapti`);
  startBot();
});
