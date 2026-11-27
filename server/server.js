import "./utils/loadEnv.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { connectDB } from "./db/db.js";
import startBot from "./bot/bot.js";
import visitorTracker from "./middleware/visitorTracker.js";
import authRoutes from "./routes/authRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import ratingRoutes from "./routes/ratingRoutes.js";
import { initSocketIO } from "./socket/gameSocket.js";
import { initOctagonSocket } from "./socket/octagonSocket.js";
import { initJumanjiSocket } from "./socket/jumanjiSocket.js";

const app = express();
const httpServer = createServer(app);

const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isOriginAllowed(origin, req) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  try {
    const parsedOrigin = new URL(origin);
    const forwardedHost = req?.headers?.["x-forwarded-host"];
    const rawHost =
      (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ||
      req?.headers?.host ||
      "";
    const expectedHost = rawHost.split(",")[0].trim();
    if (expectedHost && parsedOrigin.host === expectedHost) {
      return true;
    }
    if (
      parsedOrigin.hostname === "localhost" ||
      parsedOrigin.hostname === "127.0.0.1"
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

// Socket.IO
const io = new Server(httpServer, {
  allowRequest: (req, callback) => {
    callback(null, isOriginAllowed(req.headers.origin, req));
  },
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      try {
        const u = new URL(origin);
        if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
          return callback(null, true);
        }
      } catch {
        return callback(new Error("CORS origin rejected"));
      }
      return callback(null, false);
    },
    methods: ["GET", "POST"],
  },
});

app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    callback(null, {
      origin: isOriginAllowed(origin, req),
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });
  }),
);

app.use(express.json());
app.use(visitorTracker);

// Marshrutlar
app.use("/api/auth", authRoutes);
app.use("/api/users", authRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/rating", ratingRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Hatify server is running 🚀" });
});

// Database offline error fallback middleware
app.use((err, req, res, next) => {
  if (
    err.name === "MongooseError" ||
    err.name === "MongoNetworkError" ||
    err.message?.includes("buffering timed out") ||
    err.message?.includes("Client must be connected")
  ) {
    console.warn("[AI Studio] Database offline — returning mock empty response");
    if (req.method === "GET") {
      return res.json(req.path.endsWith("s") || req.path.endsWith("s/") ? [] : {});
    }
    return res.status(503).json({ error: "Service temporarily unavailable (database offline)" });
  }
  next(err);
});

// Built frontend static files & SPA fallback
const distDir = path.resolve(__dirname, "../dist");
app.use(express.static(distDir));
app.use((req, res, next) => {
  if (
    req.method === "GET" &&
    !req.path.startsWith("/api") &&
    !req.path.startsWith("/socket.io")
  ) {
    return res.sendFile(path.join(distDir, "index.html"));
  }
  next();
});

// Socket.IO ishga tushirish
initSocketIO(io);
initOctagonSocket(io);
initJumanjiSocket(io);

await connectDB();

const PORT = Number(process.env.PORT) || 3000;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server http://0.0.0.0:${PORT} da ishlayapti`);
  startBot(io);
});
